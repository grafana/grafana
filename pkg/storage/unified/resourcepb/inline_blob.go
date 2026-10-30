package resourcepb

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"strconv"
	"strings"

	"google.golang.org/grpc/metadata"
)

// Inline blob version 1 limits keep base64 payloads below the default 4 MiB
// gRPC receive limit. Resource metadata and spec still need to fit that limit.
const (
	InlineBlobVersion    = 1
	MaxInlineBlobEntries = 16
	MaxInlineBlobSize    = 1 << 20
	MaxInlineBlobsSize   = 2 << 20
)

// InlineBlobMetadataKey carries the required version in BulkProcess request
// metadata and its acknowledgement in response headers on that same stream.
const InlineBlobMetadataKey = "x-gf-batch-inline-blobs"

// ValidateInlineBlobAcknowledgement checks response headers, not request
// metadata. Callers must obtain them successfully before sending resource bodies.
// An acknowledgement does not replace checking the final bulk response.
func ValidateInlineBlobAcknowledgement(header metadata.MD) error {
	versions := header.Get(InlineBlobMetadataKey)
	if len(versions) != 1 || versions[0] != strconv.Itoa(InlineBlobVersion) {
		return fmt.Errorf("BulkProcess did not acknowledge inline blob version %d", InlineBlobVersion)
	}
	return nil
}

// BlobReference is the persisted and read-side shape at blobs.<name>, including
// GET and LIST responses. It has no Data field: content is fetched separately.
type BlobReference struct {
	UID         string `json:"uid"`
	ContentType string `json:"contentType,omitempty"`
	Size        int64  `json:"size,omitempty"`
	Hash        string `json:"hash,omitempty"`
}

// BlobEntry is a write-input type only, never a persistence or response type.
// Nonempty Data must be uploaded and replaced with an authoritative BlobReference
// before persistence, history, or any resource response (including GET and LIST).
// DecodeBlobEntries validates presence as well as values; unmarshalling this
// struct alone does not validate the contract.
type BlobEntry struct {
	UID         string `json:"uid,omitempty"`
	ContentType string `json:"contentType,omitempty"`
	Size        int64  `json:"size,omitempty"`
	Hash        string `json:"hash,omitempty"`
	Data        []byte `json:"data,omitempty"`
}

// DecodeBlobEntries validates a present top-level blobs object, not an entire
// resource. Callers must leave absent blobs absent. The result is not suitable
// for rewriting reference entries: unknown reference fields must be preserved.
// Limits apply to inline-bearing objects only, leaving legacy references alone.
func DecodeBlobEntries(value json.RawMessage) (map[string]BlobEntry, error) {
	entries, err := decodeBlobObject(value)
	if err != nil {
		return nil, fmt.Errorf("blobs: %w", err)
	}
	result := make(map[string]BlobEntry, len(entries))
	total := 0
	hasInline := false
	for name, raw := range entries {
		entry, inline, err := decodeBlobEntry(raw)
		if err != nil {
			return nil, fmt.Errorf("blobs.%s: %w", name, err)
		}
		if inline {
			hasInline = true
			if len(entries) > MaxInlineBlobEntries {
				return nil, fmt.Errorf("inline blobs allow at most %d entries", MaxInlineBlobEntries)
			}
			total += len(entry.Data)
			if total > MaxInlineBlobsSize {
				return nil, fmt.Errorf("inline blobs exceed %d decoded bytes", MaxInlineBlobsSize)
			}
		}
		result[name] = entry
	}
	if hasInline {
		for name := range entries {
			if strings.TrimSpace(name) == "" {
				return nil, fmt.Errorf("inline blob names must not be empty")
			}
		}
	}
	return result, nil
}

func decodeBlobEntry(raw json.RawMessage) (BlobEntry, bool, error) {
	fields, err := decodeBlobObject(raw)
	if err != nil {
		return BlobEntry{}, false, err
	}
	data, inline := fields["data"]
	uid, reference := fields["uid"]
	if inline == reference {
		return BlobEntry{}, false, fmt.Errorf("exactly one of data or uid is required")
	}
	var entry BlobEntry
	if !inline {
		if err := json.Unmarshal(uid, &entry.UID); err != nil || strings.TrimSpace(entry.UID) == "" {
			return BlobEntry{}, false, fmt.Errorf("uid must be a nonempty string")
		}
		// Reference metadata was optional before inline input existed. Preserve
		// compatibility, including extension fields, without trusting that metadata.
		for name, value := range fields {
			var target any
			switch name {
			case "contentType":
				target = &entry.ContentType
			case "size":
				target = &entry.Size
			case "hash":
				target = &entry.Hash
			default:
				continue
			}
			if err := json.Unmarshal(value, target); err != nil {
				return BlobEntry{}, false, fmt.Errorf("invalid reference metadata %q: %w", name, err)
			}
		}
		return entry, false, nil
	}
	for field := range fields {
		if field != "data" && field != "contentType" {
			return BlobEntry{}, true, fmt.Errorf("unsupported inline field %q", field)
		}
	}
	if err := json.Unmarshal(fields["contentType"], &entry.ContentType); err != nil || entry.ContentType == "" {
		return BlobEntry{}, true, fmt.Errorf("contentType must be a nonempty media type")
	}
	mediaType, _, err := mime.ParseMediaType(entry.ContentType)
	if err != nil || !strings.Contains(mediaType, "/") || strings.Contains(mediaType, "*") {
		return BlobEntry{}, true, fmt.Errorf("contentType must be a concrete media type")
	}
	var encoded string
	if err := json.Unmarshal(data, &encoded); err != nil || encoded == "" {
		return BlobEntry{}, true, fmt.Errorf("data must be nonempty base64")
	}
	// Bound allocations before decoding. Reject whitespace and noncanonical
	// encodings so every accepted string has one unambiguous byte representation.
	if len(encoded) > base64.StdEncoding.EncodedLen(MaxInlineBlobSize) {
		return BlobEntry{}, true, fmt.Errorf("data exceeds %d decoded bytes", MaxInlineBlobSize)
	}
	entry.Data, err = base64.StdEncoding.Strict().DecodeString(encoded)
	if err != nil || base64.StdEncoding.EncodeToString(entry.Data) != encoded {
		return BlobEntry{}, true, fmt.Errorf("data must be canonical padded base64")
	}
	if len(entry.Data) > MaxInlineBlobSize {
		return BlobEntry{}, true, fmt.Errorf("data exceeds %d decoded bytes", MaxInlineBlobSize)
	}
	return entry, true, nil
}

// Duplicate names could otherwise validate one value and persist another when
// downstream JSON implementations disagree about which occurrence wins.
func decodeBlobObject(raw json.RawMessage) (map[string]json.RawMessage, error) {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	token, err := decoder.Token()
	if err != nil || token != json.Delim('{') {
		return nil, fmt.Errorf("expected an object")
	}
	fields := make(map[string]json.RawMessage)
	for decoder.More() {
		token, err := decoder.Token()
		if err != nil {
			return nil, err
		}
		name, ok := token.(string)
		if !ok {
			return nil, fmt.Errorf("expected a field name")
		}
		if _, exists := fields[name]; exists {
			return nil, fmt.Errorf("duplicate field %q", name)
		}
		var value json.RawMessage
		if err := decoder.Decode(&value); err != nil {
			return nil, err
		}
		fields[name] = value
	}
	if _, err := decoder.Token(); err != nil {
		return nil, err
	}
	if err := decoder.Decode(new(json.RawMessage)); err != io.EOF {
		return nil, fmt.Errorf("unexpected trailing content")
	}
	return fields, nil
}
