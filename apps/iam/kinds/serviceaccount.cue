package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

serviceaccountKind: {
	kind:       "ServiceAccount"
	pluralName: "ServiceAccounts"
	codegen: {
		ts: {enabled: false}
		go: {enabled: true}
	}
}

serviceaccountv0alpha1: serviceaccountKind & {
	schema: {
		spec: v0alpha1.ServiceAccountSpec
	}
	routes: {
		"/tokens": {
			"GET": {
				name: "listServiceAccountTokens"
				request: {
					query: {
						limit?:    int64
						continue?: string
					}
				}
				response: {
					items: [...#Token]
					continue: string
				}
			}
		}
		"/tokens/{tokenName}": {
			"GET": {
				name: "getServiceAccountToken"
				response: {
					body: #Token
				}
			}
		}
		"/tokens": {
			"POST": {
				name: "createServiceAccountToken"
				request: {
					body: {
						tokenName:        string
						expiresInSeconds: int64
					}
				}
				response: {
					token:                   string
					serviceAccountTokenName: string
					expires:                 int64
				}
			}
		}
		"/tokens/{tokenName}": {
			"DELETE": {
				name: "deleteServiceAccountToken"
				response: {
					message: string
				}
			}
		}
	}
}

#Token: {
	title:    string
	revoked:  bool
	expires:  int64
	created:  int64
	updated:  int64
	lastUsed: int64
}
