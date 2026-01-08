# Notes on Sensu Go Docker Block

The API Key needed to connect to Sensu Go has to be created manually.

## Create the API Key

`docker exec -it sensu-backend /bin/ash`

Configure the `sensuctl` command using the pre-set username and password:

```bash
sensuctl configure -n --url http://127.0.0.1:8080 --username admin --password 'Password123' --namespace default
```

Generate the API Key:

```bash
sensuctl api-key grant admin
```

The output should look similar to this:

```
Created: /api/core/v2/apikeys/0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d
```

## Configuring the notification channel

### Backend URL

The Backend URL is the API port (8080) forwarded to the container, it should be
`http://localhost:8080`

### API Key

The `0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d` in the output above is the API Key
to use in configuring the Sensu Go notification channel.
