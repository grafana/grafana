// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Represents a glimpse into the data.
// For more details about facets, visit:
// http://elasticsearch.org/guide/reference/api/search/facets/
type Facet interface {
	Source() interface{}
}
