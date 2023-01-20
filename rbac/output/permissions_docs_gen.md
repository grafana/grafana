| Action                          | Applicable scope                                                       | Description                                               |
| ------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------- |
| `dashboards:read`               | `dashboards:*`<br>`dashboards:uid:*`<br>`folders:*`<br>`folders:uid:*` | Read one or more dashboards.                              |
| `dashboards:write`              | `dashboards:*`<br>`dashboards:uid:*`<br>`folders:*`<br>`folders:uid:*` | Update one or more dashboards                             |
| `dashboards:create`             | `folders:*`<br>`folders:uid:*`                                         | Create dashboards in one or more folders.                 |
| `dashboards:delete`             | `dashboards:*`<br>`dashboards:uid:*`<br>`folders:*`<br>`folders:uid:*` | Delete one or more dashboards.                            |
| `dashboards.permissions:read`   | `dashboards:*`<br>`dashboards:uid:*`<br>`folders:*`<br>`folders:uid:*` | Read permissions for one or more dashboards.              |
| `dashboards.permissions:write`  | `dashboards:*`<br>`dashboards:uid:*`<br>`folders:*`<br>`folders:uid:*` | Update permissions for one or more dashboards.            |
| `dashboards.public:write`       | `dashboards:*`<br>`dashboards:uid:*`<br>`folders:*`<br>`folders:uid:*` |                                                           |
| `dashboards.insights:read`      | n/a                                                                    | Read dashboard insights data and see presence indicators. |
| `datasources:read`              | `datasources:*`<br>`datasources:uid:*`                                 | Read one or more data sources.                            |
| `datasources:query`             | `datasources:*`<br>`datasources:uid:*`                                 | Query one or more data sources.                           |
| `datasources:create`            | `datasources:*`<br>`datasources:uid:*`                                 | Create data sources                                       |
| `datasources:write`             | `datasources:*`<br>`datasources:uid:*`                                 | Update one or more data sources.                          |
| `datasources:delete`            | `datasources:*`<br>`datasources:uid:*`                                 | Delete one or more data sources                           |
| `datasources:explore`           | n/a                                                                    | Enable access to the **Explore** tab.                     |
| `datasources.permissions:read`  | `datasources:*`<br>`datasources:uid:*`                                 | Read permissions for one or more data sources.            |
| `datasources.permissions:write` | `datasources:*`<br>`datasources:uid:*`                                 | Update permissions for one or more data sources.          |
| `datasources.id:read`           | `datasources:*`<br>`datasources:uid:*`                                 | Read data source IDs.                                     |
| `datasources.caching:read`      | `datasources:*`<br>`datasources:uid:*`                                 | Read data source query caching settings.                  |
| `datasources.caching:write`     | `datasources:*`<br>`datasources:uid:*`                                 | Update data source query caching settings.                |
| `datasources.insights:read`     | n/a                                                                    | Read data sources insights data.                          |
| `folders:read`                  | `folders:*`<br>`folders:uid:*`                                         | Read one or more folders.                                 |
| `folders:write`                 | `folders:*`<br>`folders:uid:*`                                         | Update one or more folders.                               |
| `folders:delete`                | `folders:*`<br>`folders:uid:*`                                         | Delete one or more folders.                               |
| `folders:create`                | `folders:*`<br>`folders:uid:*`                                         | Create folders.                                           |
| `folders.permissions:read`      | `folders:*`<br>`folders:uid:*`                                         | Read permissions for one or more folders.                 |
| `folders.permissions:write`     | `folders:*`<br>`folders:uid:*`                                         | Update permissions for one or more folders.               |
