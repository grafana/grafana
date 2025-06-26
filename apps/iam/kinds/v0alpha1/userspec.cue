package v0alpha1

import (
    t "time"
)

UserSpec: {
    disabled: bool
    email: string
    emailVerified: bool
    grafanaAdmin: bool
    lastSeenAt: string & t.Time
    login: string
    name: string
    provisioned: bool

    // What to do with salt, rands and password?
}
