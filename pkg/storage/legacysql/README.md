# Legacy SQL

As we transition from our internal sql store towards unified storage, we can sometimes use existing
services to implement a k8s compatible storage that can then dual write into unified storage.

However sometimes it is more efficient and cleaner to write explicit SQL commands designed for this goal.

This package provides some helper functions to make this easier.