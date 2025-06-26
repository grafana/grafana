package v0alpha1

import "time"

UserSpec: {
    disabled: bool
    email: string
    emailVerified: bool
    grafanaAdmin: bool
    lastSeenAt: string & time.Time
    login: string
    name: string
    provisioned: bool

    // What to do with salt, rands and password?
}
