package v0alpha1

import "time"

ServiceAccountTokenSpec: {
    name: string       
	revoked: bool         
	expires: string & time.Time
	lastUsed: string & time.Time
	created: string & time.Time
}