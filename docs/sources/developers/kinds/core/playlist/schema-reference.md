+++
draft: true
keywords = ["grafana", "schema", "documentation"]
+++

# Kind: Playlist

### Maturity: merged

### Version: 0.0

## Properties

| Property   | Type               | Required | Description                                                                                        |
| ---------- | ------------------ | -------- | -------------------------------------------------------------------------------------------------- |
| `interval` | string             | **Yes**  | Interval sets the time between switching views in a playlist.                                      |
|            |                    |          | FIXME: Is this based on a standardized format or what options are available? Can datemath be used? |
| `name`     | string             | **Yes**  | Name of the playlist.                                                                              |
| `uid`      | string             | **Yes**  | Unique playlist identifier. Generated on creation, either by the                                   |
|            |                    |          | creator of the playlist of by the application.                                                     |
| `items`    | [object](#items)[] | No       | The ordered list of items that the playlist will iterate over.                                     |
|            |                    |          | FIXME! This should not be optional, but changing it makes the godegen awkward                      |

## items

### Properties

| Property | Type   | Required | Description                                                                                       |
| -------- | ------ | -------- | ------------------------------------------------------------------------------------------------- |
| `type`   | string | **Yes**  | Type of the item. Possible values are: `dashboard_by_uid`, `dashboard_by_id`, `dashboard_by_tag`. |
| `value`  | string | **Yes**  | Value depends on type and describes the playlist item.                                            |
|          |        |          |                                                                                                   |
|          |        |          | - dashboard_by_id: The value is an internal numerical identifier set by Grafana. This             |
|          |        |          | is not portable as the numerical identifier is non-deterministic between different instances.     |
|          |        |          | Will be replaced by dashboard_by_uid in the future. (deprecated)                                  |
|          |        |          | - dashboard_by_tag: The value is a tag which is set on any number of dashboards. All              |
|          |        |          | dashboards behind the tag will be added to the playlist.                                          |
|          |        |          | - dashboard_by_uid: The value is the dashboard UID                                                |
| `title`  | string | No       | Title is an unused property -- it will be removed in the future                                   |
