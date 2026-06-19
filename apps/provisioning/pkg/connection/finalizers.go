package connection

// ReferencedByRepositoriesFinalizer keeps a Connection alive while any Repository
// still references it via spec.connection.name.
//
// Repository deletion is asynchronous (finalizer-driven): a repository DELETE
// returns immediately while its own finalizers run, so the reference to a
// connection is only cleared once the repository is fully gone. Without this
// finalizer a connection could be removed inside that window, while a
// referencing repository's finalizers may still need the connection's
// credentials (for example to refresh a token and clean up a webhook).
//
// The connection controller manages this finalizer: it adds it only while a
// repository references the connection and removes it once none remain. An
// unreferenced connection never carries the finalizer and so deletes
// synchronously.
const ReferencedByRepositoriesFinalizer = "await-referencing-repositories"
