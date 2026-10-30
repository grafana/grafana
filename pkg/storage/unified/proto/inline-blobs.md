# Inline blob contract, version 1

This is a shared write-time contract, not a declaration that servers support it.
No producer sends inline blobs as part of this contract-only change. Server
normalization and lifecycle protection ship with the bulk handshake before
producer adoption.

## Resource JSON

Only top-level `blobs.<name>` entries participate. Generic storage never searches
resource-specific `spec` fields. Each entry is either:

```json
{"contentType":"application/json","data":"e30="}
```

or a reference:

```json
{"uid":"uploaded-uid","contentType":"application/json","size":2,"hash":"server-hash"}
```

`resourcepb.BlobEntry` is the shared **write-input-only** Go JSON shape;
`DecodeBlobEntries` validates a present `blobs` object. Persistence and response
code must use the reference-only `resourcepb.BlobReference` shape, which has no
`data` field, rather than reuse the input type. These are JSON types, not new
protobuf resource fields. Unknown fields on existing references still need to be
preserved when transforming raw resource JSON.

When resource schemas adopt the inline/reference union, `data` must be marked
`writeOnly: true` in their OpenAPI representation and documented as input-only in
generated types. Schema generation must retain that distinction; do not expose
the input union as the read-side type without a reference-only output contract.
An OpenAPI annotation or Go `omitempty` tag alone does not strip nonempty data
from a response. Server normalization must enforce the reference-only boundary.
The snapshot schema is deliberately unchanged until its producer PR.

### Presence and validation

- Exactly one of the **keys** `data` and `uid` must be present. A null or empty
  value does not count as an absent key; an entry containing both is invalid.
- `blobs` and each entry must be objects, not arrays or null. An empty object is
  allowed for `blobs`, not for an entry. Do not manufacture an empty `blobs`
  object on resources where the field was absent: existing reads distinguish
  these cases.
- Duplicate names in `blobs` and duplicate fields in an entry are rejected.
- Inline data must be a nonempty string of canonical, padded, standard RFC 4648
  base64. Whitespace, URL-safe encoding, malformed padding, and nonzero padding
  bits are rejected. Bytes are never implicitly serialized as JSON.
- Zero-byte inline content is not supported in version 1. Current KV, CDK, and
  streaming blob paths reject empty content; accepting it here would make
  behavior backend-dependent.
- Inline `contentType` is required and must parse as a concrete media type,
  optionally with parameters, not a wildcard. The server produces authoritative
  content type and reference metadata from the upload result.
- Inline entries allow only `data` and `contentType`. Client-supplied reference
  metadata (`size`, `hash`) and unknown fields are rejected on inline entries.
- References require a nonblank string `uid`. Existing optional metadata remains
  optional; typed metadata must decode into the Go reference fields. Unknown
  reference fields are accepted and must be preserved, not reconstructed from
  the decoded Go struct. Reference metadata is not proof of ownership or content.
- In an object containing inline input, names must be nonblank, there may be at
  most **16 total entries**, each inline payload may contain at most **1 MiB**
  decoded bytes, and all inline payloads together at most **2 MiB** decoded bytes.
  Reference-only objects are not subject to these new inline limits.
- Base64 adds approximately 33% transport overhead. These decoded limits do not
  supersede transport limits: the entire resource, bulk message, metadata, and
  protobuf envelope must also fit the configured gRPC receive limit (normally
  4 MiB). A resource with a large non-blob body can still exceed that limit.

The helper validates only the blob contract; it does not authorize uploads,
validate resource identity or reference ownership, upload bytes, or mutate the
resource. Normalization must preserve unrelated fields and unknown reference
fields using the original resource JSON.

## Persistence and reads

`data` is write-only. An inline-capable server must authorize and validate the
request identity, upload under that identity, and replace each inline entry with
an authoritative reference **before** resource persistence or history is written.
Neither `SkipValidation` nor a missing blob backend may bypass normalization.
Deletion entries must never trigger uploads. Ordinary dry-runs must not upload.

Upload failure, including a response's embedded `Error`, prevents resource
publication. Resource persistence failure after upload may leave an orphan, but
must not produce a dangling published reference. Bulk operations do not promise
transaction-wide rollback. Advertising support requires tested cancellation,
partial-commit behavior, and protection from GC until references become visible,
plus safe cleanup of abandoned uploads. This contract does not implement or
choose the backend lifecycle mechanism.

Ordinary resource **GET and LIST responses**, including every item in paginated
lists, contain references only: `blobs.<name>.data` must be absent, not merely
null or empty. The same rule applies to history, watch events, and resource bodies
returned by writes. Inline bytes must not be persisted and stripped only at read
time; normalization must remove them before persistence so every read path is
safe by construction. Future server integration tests must verify both GET and
LIST after inline ingestion, as well as stored/history bodies and watch events.

There is no generic rehydration. Snapshot dashboard reads retain their authorized
`/dashboard` endpoint and legacy inline-read compatibility. Existing direct/
streaming uploads, provisioning preview URLs, and provisioning's GC exemption are
unchanged.

## Automatic negotiation within BulkProcess

Support detection and ingestion use the existing `BulkStore.BulkProcess` stream.
There is no discovery RPC, additional service, new proto file, or separate blob
upload step for producers. Request and response metadata use the shared
`resourcepb.InlineBlobMetadataKey`, `x-gf-batch-inline-blobs`.

The bulk client path performs this handshake automatically for inline-enabled
imports, before sending **any** resource bodies:

1. Open `BulkProcess` with exactly one `x-gf-batch-inline-blobs: 1` request
   metadata value, preserving collection and other existing metadata.
2. Wait for initial response headers on that same stream. A supporting server
   validates the requested version and stream setup, then explicitly flushes
   exactly one `x-gf-batch-inline-blobs: 1` response header using `SendHeader`
   **before** waiting for resource messages. Merely setting pending headers is
   insufficient: both sides would otherwise wait for each other.
3. Handle any transport error first, then validate the acknowledgement with
   `resourcepb.ValidateInlineBlobAcknowledgement`. Missing, empty, duplicate,
   malformed, or unknown versions fail closed; version comparison is exact,
   not greater-than. A successful RPC or working direct `PutBlob` is not support.
4. Only after acknowledgement, send resource messages. The endpoint discovers
   `blobs.<name>.data`, validates identity and authorization for each resource,
   uploads the bytes, and forwards reference-only bodies to the bulk backend.
   The producer never performs separate uploads or rehydrates resource fields.
5. Require successful final `CloseAndRecv`, a nonnil response, and no embedded
   `Error`. Initial acknowledgement is permission to send inline input, not
   confirmation that the import committed.

A bounded handshake timeout must cancel the stream if headers do not arrive.
Older servers may wait for a resource message before sending headers, so waiting
without a timeout would deadlock. Header errors, missing acknowledgements, early
stream closure, and timeout must all prevent sending bodies and cancel/close the
stream. The handshake timer must stop after successful negotiation; it must not
impose that short timeout on the entire import. Cancellation must unblock the
header wait without leaking a goroutine.

After a failed handshake, do not retry with inline content in `spec`, silently
fall back to storing `data`, or mark migration complete. A separately designed
legacy path may remain but is not a successful reference-only migration.

Acknowledgement applies only to this stream and the server handling it. Do not
cache it, reuse it for another stream, or infer support for ordinary Create/Update.
Retries open a new stream and negotiate again. A proxy must not synthesize an
acknowledgement unless its selected downstream provides the same guarantees.
This avoids a separate probe reaching one replica and an import reaching another.

The server acknowledges only when complete normalization and lifecycle safety
are enabled for the stream's backend and scope. Unsupported versions or disabled
blob support must be rejected without acknowledging. Acknowledgement never
bypasses per-resource authorization or key/body validation, which occur after
messages arrive. Any resource outside the accepted scope must be rejected.

The handshake is an old-server safety gate, not an opt-in for normalization.
Once implemented, the endpoint must normalize inline input regardless of whether
the client requested the handshake; no path, including `SkipValidation`, may
persist write-only `data`. Existing clients without negotiation continue to use
their existing reference-only and non-blob writes without a header wait.

This PR defines only metadata constants, acknowledgement validation, and the
contract. It neither sends acknowledgements nor enables inline producers. The
server PR implements negotiation and normalization together, with remote and
in-process stream tests, before a later client-only PR enables automatic
negotiation for producers. Support for ordinary writes remains separate work;
this bulk handshake does not enable or advertise it.
