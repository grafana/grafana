# Admission hooks for app plugin kinds

For app plugin authors declaring `admission` on a kind in their manifest, and for anyone
changing how those hooks are dispatched. The short version: **a kind that declares both
mutation and validation for the same operation gets one `AdmissionReview` call, not two,
and that call happens in the mutating phase.**

This is experimental. The v3 plugin protocol and this wiring can both change.

## Declaring the hooks

Each kind version in the manifest carries an optional `admission` block, with a separate
operation list per capability:

```yaml
kinds:
  - kind: Thing
    plural: things
    scope: Namespaced
    admission:
      mutation:
        operations: [CREATE]
      validation:
        operations: ["*"] # CREATE, UPDATE, DELETE
```

Both lists are **per operation**. A capability with no operations is the same as not
declaring it at all. Nothing is called for a kind that declares neither.

Two operations never reach the plugin:

- **CONNECT** has no representation in `AdmissionReviewRequest.Operation`. Declare it and
  it is silently dropped. Connect traffic reaches plugins through custom routes instead.
- **Subresource writes** (`/status`) are skipped entirely. The v3 request has no
  subresource field, so the hook could not tell a status write from a write to the main
  resource, and answering as if it were the main resource is worse than not answering.

## One call, not two

The v3 protocol has a single `AdmissionReview` RPC whose response carries both the
allow/deny decision *and* the mutated object. Kubernetes-style mutating and validating
webhooks are separate endpoints; this is not. So dispatch collapses to whichever phase
comes first for that operation:

| Declared for the operation | Reviewed in     | Plugin calls |
| -------------------------- | --------------- | ------------ |
| mutation + validation      | mutating phase  | 1            |
| mutation only              | mutating phase  | 1            |
| validation only            | validating phase| 1            |
| neither                    | —               | 0            |

A denial is enforced wherever the call happens, so a plugin that only declares mutation
can still reject a request. That matches Kubernetes, where a mutating webhook may deny.

Because the gating is per operation, a kind that declares mutation on `CREATE` and
validation on `CREATE`+`DELETE` is reviewed once in the mutating phase on create, and once
in the validating phase on delete.

## What the plugin sees when both are configured

This is the part worth understanding before you rely on a validation rule. The order for a
create is:

1. **Mutating admission** — the plugin is called, and its returned object is applied
2. `Store.create` fills uid and creationTimestamp, and **generates the name** from `generateName`
3. `rest.BeforeCreate` runs `PrepareForCreate` (**strips `status`**, sets `generation: 1`),
   then the OpenAPI **schema validation**, then ObjectMeta validation
4. **Validating admission** — skipped when the mutating phase already ran
5. Persist

The plugin's `object_bytes` is the object **as submitted** — step 1's input. Its verdict is
therefore computed before its own mutation is applied, and before steps 2 and 3 happen at
all. Three consequences:

- On a `generateName` create the plugin sees `metadata.name` empty. It cannot validate the
  final name.
- `status` is still on the body during `CREATE`. A rule like *"status must not be set on
  create"* fires against the submitted object, not the stripped one.
- Server-assigned uid and creationTimestamp are not visible.

If a kind needs the post-strategy view for an operation, declare **validation only** for
that operation — then the call moves to step 4 and sees everything above. What you cannot
have on a single operation is both a mutation hook and a post-strategy validation view.
That is a property of having one RPC, not of this wiring.

### Schema validation is not weakened by the skip

Step 3 runs strictly **after** the mutation and strictly **before** validating admission.
A plugin that mutates its object into a shape the kind's OpenAPI schema rejects is still
caught, by `validateAgainstSchema` in the REST strategy. Dropping the plugin's second call
costs visibility, never enforcement.

The plugin is also on both sides of the exchange: it already knows what it is about to
return, so validating its own output is an internal concern rather than something worth a
second round trip.

## Denials, warnings, and failures

- **Denial.** `allowed: false`, or any `error` on the response, rejects the request. The
  plugin's `code`, `reason`, `message`, and `details.causes` are carried onto the API
  error. Returning `422` with field causes, `409`, or `429` with `retryAfterSeconds` all
  work. A plugin that says nothing gets **403 Forbidden**, and any code below `400` is
  raised to `400`, so a denial can never come back looking like a success or a redirect —
  the same guard Kubernetes applies to webhook rejections.
- **Warnings** are forwarded to the request's warning recorder and reach the client as
  `Warning` headers.
- **Failure is closed.** A kind that declares a hook cannot be written without it, so an
  unreachable plugin or an unparsable mutation response fails the request rather than
  admitting silently. A missing plugin client is caught at startup by `newKindStore`, not
  at request time.
- **Identity is not mutable.** The mutated object's GVK, name, generateName, namespace,
  uid, and resourceVersion are restored from the incoming object. By the time admission
  runs, the request path and storage key are already derived from those, so a hook that
  renamed the object would have it written under a key that no longer matched.

## Where the code lives

`admission.go` holds all of it. `mutateAdmission`, `validateAdmission`, `admissionReview`,
`applyMutation`, and `admissionDenied` are `*kindStore` methods; the kind's declared
operations are read off the manifest in `newKindStore` (`kindstore.go`).

`AppPluginAPIBuilder.Mutate` and `.Validate` are the entry points, implementing
`builder.APIGroupMutation` and `builder.APIGroupValidation`. They are thin routers: the
admission chain registers per **GroupVersion**, while these hooks are per **resource**, so
they look the target kind up in the `kinds` map built in `UpdateAPIGroupInfo`.

Dispatching from the REST strategy instead is not an option worth revisiting:
`PrepareForCreate` cannot return an error, `strategy.Validate` flattens everything to
`422`, and `RESTDeleteStrategy` is `runtime.ObjectTyper` and nothing else — so DELETE has
no strategy hook at all.
