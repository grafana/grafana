# DEPRECATED - OUT OF USE

This repository is not longer in used or maintained. Icons were moved to be part of the [grafana main repository](https://github.com/grafana/grafana) and no further interaction is required with this code.


---
= Grafana Icons

This is a repository that manages the icons used in grafana



=== generate bundle

list the iconst that should be bundled in:  `cmd/genbundle/bundle.txt` then:

```
go run cmd/genbundle/main.go > iconBundle.ts
```
