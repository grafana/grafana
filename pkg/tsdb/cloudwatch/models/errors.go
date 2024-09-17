package models

import "fmt"

// put misc expected user errors here

var ErrMissingRegion = fmt.Errorf("missing default region")
