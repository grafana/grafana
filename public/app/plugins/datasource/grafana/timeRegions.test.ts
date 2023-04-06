import { dateTime, toDataFrameDTO } from '@grafana/data';

import { doTimeRegionQuery } from './timeRegions';

describe('grafana data source', () => {
  it('supports time region query', () => {
    const frame = doTimeRegionQuery(
      { name: 'T1', color: 'green', fromDayOfWeek: 1, toDayOfWeek: 2, line: true },
      {
        from: dateTime('2023-03-01'),
        to: dateTime('2023-03-31'),
        raw: {
          to: '',
          from: '',
        },
      },
      'utc'
    );

    expect(toDataFrameDTO(frame!)).toMatchSnapshot(); // inline??
  });

  it('handles timezone conversion UTC-UTC', () => {
    // region TZ = UTC
    // dashboard TZ = UTC
    // Mon Mar 06 2023 00:00:00 GMT+0000 -> Mon Mar 06 2023 23:59:59 GMT+0000

    const frame = doTimeRegionQuery(
      { name: 'T1', color: 'green', fromDayOfWeek: 1, line: true, timezone: 'utc' },
      {
        from: dateTime('2023-03-01'),
        to: dateTime('2023-03-08'),
        raw: {
          to: '',
          from: '',
        },
      },
      'utc'
    );

    expect(toDataFrameDTO(frame!).fields).toMatchInlineSnapshot(`
      [
        {
          "config": {},
          "labels": undefined,
          "name": "time",
          "type": "time",
          "values": [
            1678060800000,
          ],
        },
        {
          "config": {},
          "labels": undefined,
          "name": "timeEnd",
          "type": "time",
          "values": [
            1678147199000,
          ],
        },
        {
          "config": {
            "color": {
              "fixedColor": "green",
              "mode": "fixed",
            },
          },
          "labels": undefined,
          "name": "color",
          "type": "string",
          "values": [
            "green",
          ],
        },
        {
          "config": {},
          "labels": undefined,
          "name": "line",
          "type": "boolean",
          "values": [
            true,
          ],
        },
      ]
    `);
  });

  it('handles timezone conversion browser-UTC', () => {
    // region TZ = browser (Pacific/Easter)
    // dashboard TZ = UTC
    // Mon Mar 06 2023 00:00:00 GMT-0600 -> Mon Mar 06 2023 23:59:59 GMT-0600
    // Mon Mar 06 2023 06:00:00 GMT+0000 -> Mon Mar 06 2023 05:59:59 GMT+0000

    const frame = doTimeRegionQuery(
      { name: 'T1', color: 'green', fromDayOfWeek: 1, line: true, timezone: 'browser' },
      {
        from: dateTime('2023-03-01'),
        to: dateTime('2023-03-08'),
        raw: {
          to: '',
          from: '',
        },
      },
      'utc'
    );

    expect(toDataFrameDTO(frame!).fields).toMatchInlineSnapshot(`
      [
        {
          "config": {},
          "labels": undefined,
          "name": "time",
          "type": "time",
          "values": [
            1678082400000,
          ],
        },
        {
          "config": {},
          "labels": undefined,
          "name": "timeEnd",
          "type": "time",
          "values": [
            1678168799000,
          ],
        },
        {
          "config": {
            "color": {
              "fixedColor": "green",
              "mode": "fixed",
            },
          },
          "labels": undefined,
          "name": "color",
          "type": "string",
          "values": [
            "green",
          ],
        },
        {
          "config": {},
          "labels": undefined,
          "name": "line",
          "type": "boolean",
          "values": [
            true,
          ],
        },
      ]
    `);
  });

  it('handles timezone conversion CDT-UTC', () => {
    // region TZ = America/Chicago
    // dashboard TZ = UTC
    // Mon Mar 06 2023 00:00:00 GMT-0500 -> Mon Mar 06 2023 23:59:59 GMT-0500 (CDT)
    // Mon Mar 06 2023 05:00:00 GMT+0000 -> Tue Mar 07 2023 04:59:59 GMT+0000

    const frame = doTimeRegionQuery(
      { name: 'T1', color: 'green', fromDayOfWeek: 1, line: true, timezone: 'America/Chicago' },
      {
        from: dateTime('2023-03-01'),
        to: dateTime('2023-03-08'),
        raw: {
          to: '',
          from: '',
        },
      },
      'utc'
    );

    expect(toDataFrameDTO(frame!).fields).toMatchInlineSnapshot(`
      [
        {
          "config": {},
          "labels": undefined,
          "name": "time",
          "type": "time",
          "values": [
            1678078800000,
          ],
        },
        {
          "config": {},
          "labels": undefined,
          "name": "timeEnd",
          "type": "time",
          "values": [
            1678165199000,
          ],
        },
        {
          "config": {
            "color": {
              "fixedColor": "green",
              "mode": "fixed",
            },
          },
          "labels": undefined,
          "name": "color",
          "type": "string",
          "values": [
            "green",
          ],
        },
        {
          "config": {},
          "labels": undefined,
          "name": "line",
          "type": "boolean",
          "values": [
            true,
          ],
        },
      ]
    `);
  });

  it('handles timezone conversion Europe/Amsterdam-UTC', () => {
    // region TZ = Europe/Amsterdam
    // dashboard TZ = UTC
    // Mon Mar 06 2023 00:00:00 GMT+0100 -> Mon Mar 06 2023 23:59:59 GMT+0100 (Europe/Amsterdam)
    // Sun Mar 05 2023 23:00:00 GMT+0000 -> Mon Mar 06 2023 22:59:59 GMT+0000

    const frame = doTimeRegionQuery(
      { name: 'T1', color: 'green', fromDayOfWeek: 1, line: true, timezone: 'Europe/Amsterdam' },
      {
        from: dateTime('2023-03-01'),
        to: dateTime('2023-03-08'),
        raw: {
          to: '',
          from: '',
        },
      },
      'utc'
    );

    expect(toDataFrameDTO(frame!).fields).toMatchInlineSnapshot(`
      [
        {
          "config": {},
          "labels": undefined,
          "name": "time",
          "type": "time",
          "values": [
            1678053600000,
          ],
        },
        {
          "config": {},
          "labels": undefined,
          "name": "timeEnd",
          "type": "time",
          "values": [
            1678139999000,
          ],
        },
        {
          "config": {
            "color": {
              "fixedColor": "green",
              "mode": "fixed",
            },
          },
          "labels": undefined,
          "name": "color",
          "type": "string",
          "values": [
            "green",
          ],
        },
        {
          "config": {},
          "labels": undefined,
          "name": "line",
          "type": "boolean",
          "values": [
            true,
          ],
        },
      ]
    `);
  });

  it('handles timezone conversion Asia/Hovd-UTC', () => {
    // region TZ = Asia/Hovd
    // dashboard TZ = UTC
    // Mon Mar 06 2023 00:00:00 GMT+0700 -> Mon Mar 06 2023 23:59:59 GMT+0700 (Asia/Hovd)
    // Sun Mar 05 2023 17:00:00 GMT+0000 -> Mon Mar 06 2023 16:59:59 GMT+0000

    const frame = doTimeRegionQuery(
      { name: 'T1', color: 'blue', fromDayOfWeek: 1, line: true, timezone: 'Asia/Hovd' },
      {
        from: dateTime('2023-03-01'),
        to: dateTime('2023-03-08'),
        raw: {
          to: '',
          from: '',
        },
      },
      'utc'
    );

    expect(toDataFrameDTO(frame!).fields).toMatchInlineSnapshot(`
      [
        {
          "config": {},
          "labels": undefined,
          "name": "time",
          "type": "time",
          "values": [
            1678035600000,
          ],
        },
        {
          "config": {},
          "labels": undefined,
          "name": "timeEnd",
          "type": "time",
          "values": [
            1678121999000,
          ],
        },
        {
          "config": {
            "color": {
              "fixedColor": "blue",
              "mode": "fixed",
            },
          },
          "labels": undefined,
          "name": "color",
          "type": "string",
          "values": [
            "blue",
          ],
        },
        {
          "config": {},
          "labels": undefined,
          "name": "line",
          "type": "boolean",
          "values": [
            true,
          ],
        },
      ]
    `);
  });

  it('handles timezone conversion UTC-Asia/Dubai', () => {
    // region TZ = UTC
    // dashboard TZ = Asia/Dubai
    // Mon Mar 06 2023 00:00:00 GMT+0000 -> Mon Mar 06 2023 23:59:59 GMT+0000 (UTC)
    // Mon Mar 06 2023 04:00:00 GMT+0400 -> Mon Mar 06 2023 03:59:59 GMT+0400 (Asia/Dubai)

    const frame = doTimeRegionQuery(
      { name: 'T1', color: 'green', fromDayOfWeek: 1, line: false, timezone: 'utc' },
      {
        from: dateTime('2023-03-01'),
        to: dateTime('2023-03-08'),
        raw: {
          to: '',
          from: '',
        },
      },
      'Asia/Dubai'
    );

    expect(toDataFrameDTO(frame!).fields).toMatchInlineSnapshot(`
      [
        {
          "config": {},
          "labels": undefined,
          "name": "time",
          "type": "time",
          "values": [
            1678060800000,
          ],
        },
        {
          "config": {},
          "labels": undefined,
          "name": "timeEnd",
          "type": "time",
          "values": [
            1678147199000,
          ],
        },
        {
          "config": {
            "color": {
              "fixedColor": "green",
              "mode": "fixed",
            },
          },
          "labels": undefined,
          "name": "color",
          "type": "string",
          "values": [
            "green",
          ],
        },
        {
          "config": {},
          "labels": undefined,
          "name": "line",
          "type": "boolean",
          "values": [
            false,
          ],
        },
      ]
    `);
  });

  it('handles timezone conversion UTC-CST', () => {
    // region TZ = UTC
    // dashboard TZ = 'America/Chicago'
    // Mon Mar 06 2023 08:00:00 GMT+0000 -> Mon Mar 06 2023 08:00:00 GMT+0000 (UTC)
    // Mon Mar 06 2023 02:00:00 GMT-0600 -> Mon Mar 06 2023 02:00:00 GMT-0600 (CST)

    const frame = doTimeRegionQuery(
      { name: 'T1', color: 'green', fromDayOfWeek: 1, from: '08:00', line: false, timezone: 'utc' },
      {
        from: dateTime('2023-03-01'),
        to: dateTime('2023-03-08'),
        raw: {
          to: '',
          from: '',
        },
      },
      'America/Chicago'
    );

    expect(toDataFrameDTO(frame!).fields).toMatchInlineSnapshot(`
      [
        {
          "config": {},
          "labels": undefined,
          "name": "time",
          "type": "time",
          "values": [
            1678089600000,
          ],
        },
        {
          "config": {},
          "labels": undefined,
          "name": "timeEnd",
          "type": "time",
          "values": [
            1678089600000,
          ],
        },
        {
          "config": {
            "color": {
              "fixedColor": "green",
              "mode": "fixed",
            },
          },
          "labels": undefined,
          "name": "color",
          "type": "string",
          "values": [
            "green",
          ],
        },
        {
          "config": {},
          "labels": undefined,
          "name": "line",
          "type": "boolean",
          "values": [
            false,
          ],
        },
      ]
    `);
  });

  it('handles timezone conversion UTC-CDT', () => {
    // region TZ = UTC
    // dashboard TZ = 'America/Chicago'
    // Mon Apr 03 2023 08:00:00 GMT+0000 -> Mon Apr 03 2023 08:00:00 GMT+0000 (UTC)
    // Mon Apr 03 2023 03:00:00 GMT-0500 -> Mon Apr 03 2023 03:00:00 GMT-0500 (CDT)

    const frame = doTimeRegionQuery(
      { name: 'T1', color: 'green', fromDayOfWeek: 1, from: '08:00', line: false, timezone: 'utc' },
      {
        from: dateTime('2023-03-30'),
        to: dateTime('2023-04-06'),
        raw: {
          to: '',
          from: '',
        },
      },
      'America/Chicago'
    );

    expect(toDataFrameDTO(frame!).fields).toMatchInlineSnapshot(`
      [
        {
          "config": {},
          "labels": undefined,
          "name": "time",
          "type": "time",
          "values": [
            1680508800000,
          ],
        },
        {
          "config": {},
          "labels": undefined,
          "name": "timeEnd",
          "type": "time",
          "values": [
            1680508800000,
          ],
        },
        {
          "config": {
            "color": {
              "fixedColor": "green",
              "mode": "fixed",
            },
          },
          "labels": undefined,
          "name": "color",
          "type": "string",
          "values": [
            "green",
          ],
        },
        {
          "config": {},
          "labels": undefined,
          "name": "line",
          "type": "boolean",
          "values": [
            false,
          ],
        },
      ]
    `);
  });
});
