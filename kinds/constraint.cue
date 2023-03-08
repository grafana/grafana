package kind

import "github.com/grafana/grafana/pkg/kindsys"

// In each child directory, the set of .cue files with 'package kind'
// must be an instance of kindsys.Core - a declaration of a core kind.
kindsys.Core
