import { render } from '@testing-library/react';

import { LogsSortOrder } from '@grafana/data';

import { createLogLine } from '../mocks/logRow';

import { HighlightedLogRenderer } from './HighlightedLogRenderer';

describe('HighlightedLogRenderer', () => {
  test.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])('Serializes JSON to the same string', (wrapLogMessage: boolean, prettifyJSON: boolean) => {
    const log = createLogLine(
      {
        entry: `{
  "_entry": "log text [149843146]",
  "counter": "11203",
  "float": "12.53",
  "wave": 0.8090169943751789,
  "label": "val3",
  "level": "info",
  "array": ["1", 2, { "test": "test" }],
}`,
      },
      {
        escape: false,
        order: LogsSortOrder.Descending,
        timeZone: 'browser',
        wrapLogMessage,
        prettifyJSON,
      }
    );

    const { container } = render(<HighlightedLogRenderer log={log} />);

    expect(container.innerHTML).toEqual(log.highlightedBody);
  });

  test.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])('Serializes deeply nested JSON to the same string', (wrapLogMessage: boolean, prettifyJSON: boolean) => {
    const log = createLogLine(
      {
        entry: `{
  "id": "user_12345",
  "profile": {
    "name": {
      "first": "Alice",
      "last": "Example"
    },
    "contact": {
      "email": "alice@example.com",
      "phone": "+1-111-1234",
      "addresses": [
        {
          "type": "home",
          "location": {
            "street": "123 Maple St",
            "city": "Springfield",
            "geo": {
              "lat": 40.7128,
              "lng": -74.0060,
              "timezone": {
                "id": "America/New_York",
                "offset": -5
              }
            }
          }
        },
        {
          "type": "work",
          "location": {
            "street": "456 Oak Ave",
            "city": "Metropolis",
            "geo": {
              "lat": 37.7749,
              "lng": -122.4194,
              "timezone": {
                "id": "America/Los_Angeles",
                "offset": -8
              }
            }
          }
        }
      ]
    }
  },
  "account": {
    "createdAt": "2023-11-10T08:30:00Z",
    "lastLogin": "2025-08-29T15:12:00Z",
    "settings": {
      "notifications": {
        "email": true,
        "sms": false,
        "categories": [
          {
            "name": "security",
            "enabled": true
          },
          {
            "name": "marketing",
            "enabled": false
          }
        ]
      },
      "theme": {
        "mode": "dark",
        "colors": {
          "background": "#1e1e1e",
          "text": "#ffffff",
          "highlights": {
            "primary": "#ff4081",
            "secondary": "#82b1ff"
          }
        }
      }
    }
  },
  "activity": [
    {
      "type": "login",
      "timestamp": "2025-08-29T15:12:00Z",
      "ip": "192.168.1.10",
      "device": {
        "type": "desktop",
        "os": {
          "name": "macOS",
          "version": "14.2"
        },
        "browser": {
          "name": "Chrome",
          "version": "126.0.6478.56"
        }
      }
    },
    {
      "type": "purchase",
      "timestamp": "2025-08-28T18:45:00Z",
      "details": {
        "orderId": "order_98765",
        "items": [
          {
            "productId": "prod_111",
            "name": "Wireless Keyboard",
            "price": 79.99,
            "quantity": 1
          },
          {
            "productId": "prod_222",
            "name": "Ergonomic Mouse",
            "price": 49.99,
            "quantity": 2
          }
        ],
        "shipping": {
          "carrier": "UPS",
          "status": "delivered",
          "estimatedDelivery": "2025-08-30T14:00:00Z"
        }
      }
    }
  ]
}`,
      },
      {
        escape: false,
        order: LogsSortOrder.Descending,
        timeZone: 'browser',
        wrapLogMessage,
        prettifyJSON,
      }
    );

    const { container } = render(<HighlightedLogRenderer log={log} />);

    expect(container.innerHTML).toEqual(log.highlightedBody);
  });

  test.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])('Serializes JSON to the same string', (wrapLogMessage: boolean, prettifyJSON: boolean) => {
    const log = createLogLine(
      {
        entry: `_entry="log text [149843146]" counter=11203 float=12.53 wave=0.8090169943751789 label=val3 level=info`,
      },
      {
        escape: false,
        order: LogsSortOrder.Descending,
        timeZone: 'browser',
        wrapLogMessage,
        prettifyJSON,
      }
    );

    const { container } = render(<HighlightedLogRenderer log={log} />);

    expect(container.innerHTML).toEqual(log.highlightedBody);
  });
});
