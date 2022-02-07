# Generate Go client

The following command generates a Go client under: `pkg/api/clients/go`

```bash
$ make client-go
```

If you need to manipulate the generated files you can modify appropriately the `mustache` templates in `templates/go`.
For more details you can refer to [here](https://openapi-generator.tech/docs/templating/) and in the mustache [manual](https://mustache.github.io/mustache.5.html).


# Generate Python client

The following command generates a Python client under: `pkg/api/clients/`

```bash
$ make client-python
```