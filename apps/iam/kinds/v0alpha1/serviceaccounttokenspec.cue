package v0alpha1

import t "time"

ServiceAccountTokenSpec: {
    name: string       
	revoked: bool         
	expires: string & t.Time
	lastUsed: string & t.Time
	created: string & t.Time
}
