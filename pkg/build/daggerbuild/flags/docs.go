// Package flags defines the "flags" that are used in various artifacts throughout the application.
// A flag is an artifact-specific string alias to a set of options.
// Examples:
//   - the 'boringcrypto' flag, when used in an artifact string like `boringcrypto:targz:linux/amd64`, informs the `targz` artifact that
//     the package name is 'grafana-boringcrypto', and that when it is built, the GOEXPERIMENT=boringcrypto flag must be set.
//   - the 'targz' flag forces the use of the 'targz' artifact, whose exention will end in `tar.gz`, and will require the compiled 'backend' and 'frontend'.
package flags
