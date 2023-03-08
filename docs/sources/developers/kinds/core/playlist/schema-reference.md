---
keywords:
  - grafana
  - schema
title: Playlist kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## Playlist

#### Maturity: [merged](../../../maturity/#merged)
#### Version: 0.0

A playlist is a series of dashboards that is automatically rotated in the browser, on a configurable interval.

| Property   | Type                            | Required | Description                                                                                                                                                                         |
|------------|---------------------------------|----------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `interval` | string                          | **Yes**  | Interval sets the time between switching views in a playlist.<br/>FIXME: Is this based on a standardized format or what options are available? Can datemath be used? Default: `5m`. |
| `name`     | string                          | **Yes**  | Name of the playlist.                                                                                                                                                               |
| `uid`      | string                          | **Yes**  | Unique playlist identifier. Generated on creation, either by the<br/>creator of the playlist of by the application.                                                                 |
| `items`    | [PlaylistItem](#playlistitem)[] | No       | The ordered list of items that the playlist will iterate over.<br/>FIXME! This should not be optional, but changing it makes the godegen awkward                                    |

### PlaylistItem

| Property | Type   | Required | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
|----------|--------|----------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `type`   | string | **Yes**  | Type of the item.<br/>Possible values are: `dashboard_by_uid`, `dashboard_by_id`, `dashboard_by_tag`.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `value`  | string | **Yes**  | Value depends on type and describes the playlist item.<br/><br/> - dashboard_by_id: The value is an internal numerical identifier set by Grafana. This<br/> is not portable as the numerical identifier is non-deterministic between different instances.<br/> Will be replaced by dashboard_by_uid in the future. (deprecated)<br/> - dashboard_by_tag: The value is a tag which is set on any number of dashboards. All<br/> dashboards behind the tag will be added to the playlist.<br/> - dashboard_by_uid: The value is the dashboard UID |
| `title`  | string | No       | Title is an unused property -- it will be removed in the future                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |


