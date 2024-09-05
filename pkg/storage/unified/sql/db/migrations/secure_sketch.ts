
let write = 
{
  metadata: {},
  spec: {},
  secure: {
    field: { secret: 'super secure value' }
  },
}

// On create/update, any 'secret' value will be sent to the secrets service
// along with the group+namespace+resource+name
// The raw value will be saved (magic magic magic) and a plaintext "key" will be returned
// eg '583443aa-8eed-4ec8-b6b5-497aef71d4a1'
// A modified version with 'key' will be saved in the resource, unified storage etc
// This value will be viewable to anyone who can view the resource
// In general, the decrypted secret will not be available over HTTP in any requests

let saved = 
{
  metadata: {},
  spec: {},
  secure: {
    field: { key: '583443aa-8eed-4ec8-b6b5-497aef71d4a1' }
  },
}

// Any update to the resource that modifies the key will be an ERROR.
// Any update to the resource that removes the field will propagate that DELETE to the secrete service




// Processes that need decrypted values will use a client (either in process or gRPC)
let request01 = {
  apiVersion: 'group/vX',
  kind: 'k',
  metadata: {
    namespace: 'ns',
    name: 'n',
  },
  secure: {
    field: { key: '583443aa-8eed-4ec8-b6b5-497aef71d4a1' }
  },
}

// The service will use the access+id tokens and validate that the requested 'key'
// was saved with the same group+kind+namespace+name (ignoring version!) and return:
let response01 = {
  secure: {
    field: { secret: 'super secure value' }
  },
}

// Everything described above gives us the same behavior that exists in secureJsonData today
// BUT... would be really nice to share/reuse some secrets across resources (enterprise only)
//
// handwave handwave... not sure how to clamp the access to global secrets
//=====

// Writing a request with external system lookup
let saved02 = 
{
  metadata: {},
  spec: {},
  secure: {
    field: { ref: { source:'vault', key: 'key in vault' } } // or maybe ref is just a simple string
  },
}

// Just like a the raw secrete, this will be replaced with key and resolved the same way
let saved03 = 
{
  secure: {
    field: { key: '583443aa-8eed-4ec8-b6b5-497aef71d4a1' }
  },
}

// In the UI, we will want to help people edit these shared keys, so will need an HTTP endpoint
// in the secret.grafana.app that will convert this key back into the ref flavor.

//-------------------------------------
// Thinking about this as types....
//-------------------------------------

// Unencrypted secret value -- this will exist for write, and in the backend for read
type SecretValue = { secret: string };

// Once saved by the service, it will be assigned a UUID that will that can be used to retrieve 
// the decrypted secret value.  The group+kind+namespace+name is also required to retrieve the value
type SecretKey = { key: string };

// When working with shared secretes (enterprise only) the requested secrete can be sent
// as a reference.  Modeled here as a string, but it may be a more complex object more
// easily usable in the UI
type SecretRef = { ref: string };

// The value used in a k8s resource is oneOf the properties above (and maybe additional optional shared properties)
type SecureFieldValue = (SecretValue|SecretKey|SecretRef) & {
  // Not sure this is necessary, but we may
  error?: string; 
};

// the "secure" section of an app platform resource
type SecureFields = Record<string, SecureFieldValue>;


