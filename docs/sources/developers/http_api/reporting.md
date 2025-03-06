---
aliases:
  - ../../http_api/reporting/
canonical: /docs/grafana/latest/developers/http_api/reporting/
description: Grafana Enterprise APIs
keywords:
  - grafana
  - enterprise
  - api
  - reporting
labels:
  products:
    - enterprise
    - oss
title: Reporting API
---

# Reporting API

This API allows you to interact programmatically with the [Reporting](/docs/grafana/latest/dashboards/create-reports/) feature.

> The Reporting API is not stabilized yet, it is still in active development and may change without prior notice.

> Reporting is only available in Grafana Enterprise. Read more about [Grafana Enterprise](/docs/grafana/latest/introduction/grafana-enterprise/).

> If you are running Grafana Enterprise, for some endpoints you'll need to have specific permissions. Refer to [Role-based access control permissions](/docs/grafana/latest/administration/roles-and-permissions/access-control/custom-role-actions-scopes/) for more information.

## List all reports

`GET /api/reports`

#### Required permissions

See note in the [introduction](#reporting-api) for an explanation.

| Action       | Scope                       |
| ------------ | --------------------------- |
| reports:read | reports:\*<br>reports:id:\* |

### Example request

```http
GET /api/reports HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

### Example response

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 1840

[
	{
		"id": 2,
		"userId": 1,
		"orgId": 1,
		"name": "Report 2",
		"recipients": "example-report@grafana.com",
		"replyTo": "",
		"message": "Hi, \nPlease find attached a PDF status report. If you have any questions, feel free to contact me!\nBest,",
		"schedule": {
			"startDate": "2022-10-02T00:00:00+02:00",
			"endDate": null,
			"frequency": "once",
			"intervalFrequency": "",
			"intervalAmount": 0,
			"workdaysOnly": false,
			"dayOfMonth": "2",
			"timeZone": "Europe/Warsaw"
		},
		"options": {
			"orientation": "landscape",
			"layout": "grid",
		},
		"enableDashboardUrl": true,
		"state": "scheduled",
		"dashboards": [
			{
				"dashboard": {
					"id": 463,
					"uid": "7MeksYbmk",
					"name": "Alerting with TestData"
				},
				"reportVariables": {
					"namefilter": "TestData"
				}
			}
		],
		"formats": [
			"pdf",
			"csv"
		],
		"created": "2022-09-19T11:44:42+02:00",
		"updated": "2022-09-19T11:44:42+02:00"
	}
]
```

### Status Codes

- **200** – OK
- **401** - Authentication failed, refer to [Authentication API](/docs/grafana/latest/developers/http_api/auth/).
- **500** – Unexpected error or server misconfiguration. Refer to server logs for more details.

## Get a report

`GET /api/reports/:id`

#### Required permissions

See note in the [introduction](#reporting-api) for an explanation.

| Action       | Scope                                                      |
| ------------ | ---------------------------------------------------------- |
| reports:read | reports:\*<br>reports:id:\*<br>reports:id:1(single report) |

### Example request

```http
GET /api/reports/2 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

### Example response

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 940

{
	"id": 2,
	"userId": 1,
	"orgId": 1,
	"name": "Report 2",
	"recipients": "example-report@grafana.com",
	"replyTo": "",
	"message": "Hi, \nPlease find attached a PDF status report. If you have any questions, feel free to contact me!\nBest,",
	"schedule": {
		"startDate": "2022-10-02T00:00:00+02:00",
		"endDate": null,
		"frequency": "once",
		"intervalFrequency": "",
		"intervalAmount": 0,
		"workdaysOnly": false,
		"dayOfMonth": "2",
		"timeZone": "Europe/Warsaw"
	},
	"options": {
		"orientation": "landscape",
		"layout": "grid",
	},
	"enableDashboardUrl": true,
	"state": "scheduled",
	"dashboards": [
		{
			"dashboard": {
				"id": 463,
				"uid": "7MeksYbmk",
				"name": "Alerting with TestData"
			},
			"timeRange": {
				"from": "",
				"to": ""
			},
			"reportVariables": {
				"namefilter": "TestData"
			}
		}
	],
	"formats": [
		"pdf",
		"csv"
	],
	"created": "2022-09-12T11:44:42+02:00",
	"updated": "2022-09-12T11:44:42+02:00"
}
```

### Status Codes

- **200** – OK
- **400** – Bad request (invalid report ID).
- **401** - Authentication failed, refer to [Authentication API](/docs/grafana/latest/developers/http_api/auth/).
- **403** – Forbidden (access denied to a report or a dashboard used in the report).
- **404** – Not found (such report does not exist).
- **500** – Unexpected error or server misconfiguration. Refer to server logs for more details.

## Create a report

`POST /api/reports`

#### Required permissions

See note in the [introduction](#reporting-api) for an explanation.

| Action         | Scope |
| -------------- | ----- |
| reports:create | n/a   |

### Example request

```http
POST /api/reports HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
	"name": "Report 4",
	"recipients": "texample-report@grafana.com",
	"replyTo": "",
	"message": "Hello, please, find the report attached",
	"schedule": {
		"startDate": "2022-10-02T10:00:00+02:00",
		"endDate": "2022-11-02T20:00:00+02:00",
		"frequency": "daily",
		"intervalFrequency": "",
		"intervalAmount": 0,
		"workdaysOnly": true,
		"timeZone": "Europe/Warsaw"
	},
	"options": {
		"orientation": "landscape",
		"layout": "grid"
	},
	"enableDashboardUrl": true,
	"dashboards": [
		{
			"dashboard": {
				"uid": "7MeksYbmk",
			},
			"timeRange": {
				"from": "2022-08-08T15:00:00+02:00",
				"to": "2022-09-02T17:00:00+02:00"
			},
			"reportVariables": {
				"variable1": "Value1"
			}
		}
	],
	"formats": [
		"pdf",
		"csv"
	]
}
```

#### Config JSON Body Schema

| Field name         | Data type | Description                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| name               | string    | Name of the report that is used as an email subject.                                                                                                                                                                                                                                                                                                                                                                                              |
| recipients         | string    | Comma-separated list of emails to which to send the report to.                                                                                                                                                                                                                                                                                                                                                                                    |
| replyTo            | string    | Comma-separated list of emails used in a reply-to field of the report email.                                                                                                                                                                                                                                                                                                                                                                      |
| message            | string    | Text message used for the body of the report email.                                                                                                                                                                                                                                                                                                                                                                                               |
| startDate          | string    | Report distribution starts from this date.                                                                                                                                                                                                                                                                                                                                                                                                        |
| endDate            | string    | Report distribution ends on this date.                                                                                                                                                                                                                                                                                                                                                                                                            |
| frequency          | string    | Specifies how often the report should be sent. Can be `once`, `hourly`, `daily`, `weekly`, `monthly`, `last` or `custom`.<br/><br/>`last` - schedules the report for the last day of month.<br/><br/>`custom` - schedules the report to be sent on a custom interval.<br/>It requires `intervalFrequency` and `intervalAmount` to be specified: for example, every 2 weeks, where 2 is an `intervalAmount` and `weeks` is an `intervalFrequency`. |
| intervalFrequency  | string    | The type of the `custom` interval: `hours`, `days`, `weeks`, `months`.                                                                                                                                                                                                                                                                                                                                                                            |
| intervalAmount     | number    | `custom` interval amount.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| workdaysOnly       | string    | Send the report only on Monday-Friday. Applicable to `hourly` and `daily` types of schedule.                                                                                                                                                                                                                                                                                                                                                      |
| timeZone           | string    | Time zone used to schedule report execution.                                                                                                                                                                                                                                                                                                                                                                                                      |
| orientation        | string    | Can be `portrait` or `landscape`.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| layout             | string    | Can be `grid` or `simple`.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| enableDashboardUrl | bool      | Adds a dashboard url to the bottom of the report email.                                                                                                                                                                                                                                                                                                                                                                                           |
| formats            | []string  | Specified what kind of attachment to generate for the report - `csv`, `pdf`, `image`.<br/>`pdf` is the default one.<br/>`csv` attaches a CSV file for each table panel.<br/>`image` embeds an image of a dashboard into the email's body.                                                                                                                                                                                                         |
| dashboards         | []object  | Dashboards to generate a report for.<br/> See "Report Dashboard Schema" section below.                                                                                                                                                                                                                                                                                                                                                            |

#### Report Dashboard Schema

| Field name                     | Data type | Description                                                                                                                                                   |
| ------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dashboard.uid                  | string    | Dashboard [UID](../dashboard#identifier-id-vs-unique-identifier-uid).                                                                                         |
| timeRange.from                 | string    | Dashboard time range from.                                                                                                                                    |
| timeRange.to                   | string    | Dashboard time range to.                                                                                                                                      |
| reportVariables.<variableName> | string    | Key-value pairs containing the template variables for this report, in JSON format. If empty, the template variables from the report's dashboard will be used. |

### Example response

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 35

{
	"id": 4,
	"message": "Report created"
}
```

### Status Codes

- **200** – OK
- **400** – Bad request (invalid json, missing or invalid fields values, etc.).
- **403** - Forbidden (access denied to a report or a dashboard used in the report).
- **500** - Unexpected error or server misconfiguration. Refer to server logs for more details

## Update a report

`PUT /api/reports/:id`

#### Required permissions

See note in the [introduction](#reporting-api) for an explanation.

| Action        | Scope                                                     |
| ------------- | --------------------------------------------------------- |
| reports:write | reports:\*</br>reports:id:\*</br>reports:1(single report) |

### Example request

See [JSON body schema](#config-json-body-schema) for fields description.

```http
GET /api/reports HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
	"name": "Updated Report",
	"recipients": "example-report@grafana.com",
	"replyTo": "",
	"message": "Hello, please, find the report attached",
	"schedule": {
		"frequency": "hourly",
		"timeZone": "Africa/Cairo",
		"workdaysOnly": true,
		"startDate": "2022-10-10T10:00:00+02:00",
		"endDate": "2022-11-20T19:00:00+02:00"
	},
	"options": {
		"orientation": "landscape",
		"layout": "grid",
	},
	"enableDashboardUrl": true,
	"state": "scheduled",
	"dashboards": [
		{
			"dashboard": {
				"id": 463,
				"uid": "7MeksYbmk",
				"name": "Alerting with TestData"
			},
			"timeRange": {
				"from": "2022-08-08T15:00:00+02:00",
				"to": "2022-09-02T17:00:00+02:00"
			},
			"reportVariables": {
				"variable1": "Value1"
			}
		}
	],
	"formats": [
		"pdf",
		"csv"
	]
}
```

### Example response

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 28

{
	"message": "Report updated"
}
```

### Status Codes

- **200** – OK
- **400** – Bad request (invalid json, missing or invalid fields values, etc.).
- **401** - Authentication failed, refer to [Authentication API](/docs/grafana/latest/developers/http_api/auth/).
- **403** – Forbidden (access denied to a report or a dashboard used in the report).
- **404** – Not found (such report does not exist).
- **500** – Unexpected error or server misconfiguration. Refer to server logs for more details.

## Delete a report

`DELETE /api/reports/:id`

#### Required permissions

See note in the [introduction](#reporting-api) for an explanation.

| Action         | Scope                                                     |
| -------------- | --------------------------------------------------------- |
| reports:delete | reports:\*</br>reports:id:\*</br>reports:1(single report) |

### Example request

```http
GET /api/reports/6 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

### Example response

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 39

{
	"message": "Report config was removed"
}
```

### Status Codes

- **200** – OK
- **400** – Bad request (invalid report ID).
- **401** - Authentication failed, refer to [Authentication API](/docs/grafana/latest/developers/http_api/auth/).
- **404** - Not found (report with this ID does not exist).
- **500** - Unexpected error or server misconfiguration. Refer to server logs for more details

## Send a report

`POST /api/reports/email`

Generate and send a report. This API waits for the report to be generated before returning. We recommend that you set the client's timeout to at least 60 seconds.

#### Required permissions

See note in the [introduction](#reporting-api) for an explanation.

| Action       | Scope |
| ------------ | ----- |
| reports:send | n/a   |

### Example request

```http
POST /api/reports/email HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "id":"3",
  "useEmailsFromReport": true
}
```

#### JSON Body Schema

| Field name          | Data type | Description                                                                                                                                            |
| ------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| id                  | string    | ID of the report to send. It is the same as in the URL when editing a report, not to be confused with the ID of the dashboard. Required.               |
| emails              | string    | Comma-separated list of emails to which to send the report to. Overrides the emails from the report. Required if `useEmailsFromReport` is not present. |
| useEmailsFromReport | boolean   | Send the report to the emails specified in the report. Required if `emails` is not present.                                                            |

### Example response

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 29

{"message":"Report was sent"}
```

### Status Codes

- **200** – Report was sent.
- **400** – Bad request (invalid json, missing content-type, missing or invalid fields, etc.).
- **401** - Authentication failed, refer to [Authentication API](/docs/grafana/latest/developers/http_api/auth/).
- **403** - Forbidden (access denied to a report or a dashboard used in the report).
- **404** - Report not found.
- **500** - Unexpected error or server misconfiguration. Refer to server logs for more details.

## Get reports branding settings

`GET /api/reports/settings`

Returns reports branding settings that are global and used across all the reports.

#### Required permissions

See note in the [introduction](#reporting-api) for an explanation.

| Action                | Scope |
| --------------------- | ----- |
| reports.settings:read | n/a   |

### Example request

```http
GET /api/reports/settings HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

### Example response

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 181

{
	"id": 1,
	"userId": 1,
	"orgId": 1,
	"branding": {
		"reportLogoUrl": "",
		"emailLogoUrl": "",
		"emailFooterMode": "sent-by",
		"emailFooterText": "Grafana Labs",
		"emailFooterLink": "https://grafana.com/"
	}
}
```

### Status Codes

- **200** – OK
- **401** - Authentication failed, refer to [Authentication API](/docs/grafana/latest/developers/http_api/auth/).
- **500** - Unexpected error or server misconfiguration. Refer to server logs for more detail

## Save reports branding settings

`POST /api/reports/settings`

Creates settings if they don't exist, otherwise updates them. These settings are global and used across all the reports.

#### Required permissions

See note in the [introduction](#reporting-api) for an explanation.

| Action                 | Scope |
| ---------------------- | ----- |
| reports.settings:write | n/a   |

### Example request

```http
POST /api/reports/settings HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
	"branding": {
		"reportLogoUrl": "https://grafana.com/reportLogo.jpg",
		"emailLogoUrl": "https://grafana.com/emailLogo.jpg",
		"emailFooterMode": "sent-by",
		"emailFooterText": "Grafana Labs",
		"emailFooterLink": "https://grafana.com/"
	}
}
```

#### JSON Body Schema

| Field name               | Data type | Description                                                                                                                                                                                                                                                                            |
| ------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| branding.reportLogoUrl   | string    | URL of an image used as a logo on every page of the report.                                                                                                                                                                                                                            |
| branding.emailLogoUrl    | string    | URL of an image used as a logo in the email.                                                                                                                                                                                                                                           |
| branding.emailFooterMode | string    | Can be `sent-by` or `none`.<br/>`sent-by` adds a "Sent by `branding.emailFooterText`" footer link to the email. Requires specifying values in the `branding.emailFooterText` and `branding.emailFooterLink` fields.<br/>`none` suppresses adding a "Sent by" footer link to the email. |
| branding.emailFooterText | string    | Text of a URL added to the email "Sent by" footer.                                                                                                                                                                                                                                     |
| branding.emailFooterLink | string    | URL address value added to the email "Sent by" footer.                                                                                                                                                                                                                                 |

### Example response

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 35

{
	"message": "Report settings saved"
}
```

### Status Codes

- **200** – OK
- **400** – Bad request (invalid json, missing or invalid fields values, etc.).
- **401** - Authentication failed, refer to [Authentication API](/docs/grafana/latest/developers/http_api/auth/).
- **500** - Unexpected error or server misconfiguration. Refer to server logs for more detail

## Send a test email

`POST /api/reports/test-email`

Sends a test email with a report without persisting it in the database.

#### Required permissions

See note in the [introduction](#reporting-api) for an explanation.

| Action       | Scope |
| ------------ | ----- |
| reports:send | n/a   |

### Example request

See [JSON body schema](#config-json-body-schema) for fields description.

```http
POST /api/reports/test-email HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{{
	"name": "Report 4",
	"recipients": "example-report@grafana.com",
	"replyTo": "",
	"message": "Hello, please, find the report attached",
	"schedule": {
		"startDate": "2022-10-02T10:00:00+02:00",
		"endDate": "2022-11-02T20:00:00+02:00",
		"frequency": "daily",
		"intervalFrequency": "",
		"intervalAmount": 0,
		"workdaysOnly": true,
		"timeZone": "Europe/Warsaw"
	},
	"options": {
		"orientation": "landscape",
		"layout": "grid"
	},
	"enableDashboardUrl": true,
	"dashboards": [
		{
			"dashboard": {
				"uid": "7MeksYbmk",
			},
			"timeRange": {
				"from": "2022-08-08T15:00:00+02:00",
				"to": "2022-09-02T17:00:00+02:00"
			},
			"reportVariables": {
				"variable1": "Value1"
			}
		}
	],
	"formats": [
		"pdf",
		"csv"
	]
}
```

### Example response

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 29

{
	"message": "Test email sent"
}
```

### Status Codes

- **200** – OK
- **400** – Bad request (invalid json, missing or invalid fields values, etc.).
- **401** - Authentication failed, refer to [Authentication API](/docs/grafana/latest/developers/http_api/auth/).
- **403** - Forbidden (access denied to a report or a dashboard used in the report).
- **500** - Unexpected error or server misconfiguration. Refer to server logs for more details
