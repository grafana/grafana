package kind

import "github.com/grafana/grafana/pkg/kindsys"

// In each child directory, the set of .cue files with 'package kind'
// must be an instance of kindsys.#CoreStructured - a declaration of a
// structured kind.
kindsys.#CoreStructured
