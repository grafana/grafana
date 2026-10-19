package kinds

manifest: {
	appName:       "annotation"
	groupOverride: "annotation.grafana.app"
	versions: {
		"v0alpha1": v0alpha1
	}
	roles: {}
}

#AnnotationItem: {
	apiVersion: string
	kind:       string
	metadata: {...}
	spec: #AnnotationSpec
}

v0alpha1: {
	kinds: [annotationv0alpha1]
	routes: {
		namespaced: {
			"/tags": {
				"GET": {
					name: "getTags"
					request: {
						query: {
							// Return tags that start with this value.
							prefix?: string
							// Return tags that contain this value.
							contains?: string
							// Maximum number of tags to return. Defaults to 100.
							limit?: int64
						}
					}
					response: {
						// List of unique tags and their counts.
						tags: [...{
							// Tag value.
							tag: string
							// Count of annotations with this tag.
							count: number
						}]
					}
				}
			}
			"/search": {
				"GET": {
					name: "getSearch"
					request: {
						query: {
							// Return only annotations on the dashboard with this UID.
							dashboardUID?: string
							// Return only annotations on the panel with this ID.
							panelID?: int64
							// Start of the time range, in Unix milliseconds.
							from?: int64
							// End of the time range, in Unix milliseconds.
							to?: int64
							// Maximum number of annotations to return in one page. Defaults to 100.
							limit?: int64
							// Continue token from the metadata.continue field of the previous page for pagination.
							continue?: string
							// Return only annotations with these tags. Repeat the parameter to pass several tags.
							tag?: [...string]
							// If true, match annotations that have any of the tags. If false (the default), an annotation must have all of them.
							tagsMatchAny?: bool
							// Return only annotations with these scopes. Repeat the parameter to pass several scopes.
							scope?: [...string]
							// If true (the default), match annotations that have any of the scopes. If false, an annotation must have all of them.
							scopesMatchAny?: bool
							// Return only annotations created by the user with this UID.
							createdBy?: string
						}
					}
					response: {
						metadata: {
							// Token for the next page. Pass it as the continue parameter. Empty on the last page.
							continue?: string
						}
						// List of annotations matching the query.
						items: [...#AnnotationItem]
					}
					responseMetadata: typeMeta: false
				}
			}
			"/graphite": {
				"POST": {
					name: "createGraphite"
					request: {
						// Annotation event in the Graphite events format.
						body: {
							// Title of the event. Becomes the first line of the annotation text.
							what: string
							// Time of the event, in Unix seconds. Defaults to the current time.
							when?: int64
							// Additional event details, appended to the annotation text on a new line.
							data?: string
							// Tags of the event, as an array of strings or a single space-separated string.
							tags: string | [...string]
						}
					}
					response: {
						spec: #AnnotationSpec
					}
					responseMetadata: objectMeta: true
				}
			}
		}
	}
	codegen: {
		ts: {
			enabled: true
		}
		go: {
			enabled: true
		}
	}
}
