function toResource(version: number, created: string, message = '', spec?: object) {
  return {
    // apiVersion doesn't affect test behavior
    apiVersion: 'apiVersion',
    kind: 'Dashboard',
    metadata: {
      name: '_U4zObQMz',
      generation: version,
      creationTimestamp: created,
      annotations: { 'grafana.app/updatedBy': 'admin', 'grafana.app/message': message },
    },
    spec: spec ?? {},
  };
}

// Specs with fields that differ for diff comparison tests
// Expected diffs: description, panels (title+id), tags, timepicker, version
const specVersion2 = { panels: [{ type: 'graph', id: 4 }], tags: ['the tag'], timepicker: {}, version: 2 };
const specVersion11 = {
  description: 'The dashboard description',
  panels: [{ type: 'graph', title: 'panel title', id: 6 }],
  tags: [],
  timepicker: { refresh_intervals: ['5s'] },
  version: 11,
};

export const versionsResourceList = {
  metadata: { continue: '' },
  items: [
    toResource(11, '2021-01-15T14:44:44+01:00', 'testing changes...', specVersion11),
    toResource(10, '2021-01-15T10:19:17+01:00'),
    toResource(9, '2021-01-15T10:18:12+01:00'),
    toResource(8, '2021-01-15T10:11:16+01:00'),
    toResource(7, '2021-01-14T15:14:25+01:00'),
    toResource(6, '2021-01-14T14:55:29+01:00'),
    toResource(5, '2021-01-14T14:28:01+01:00'),
    toResource(4, '2021-01-08T10:45:33+01:00'),
    toResource(3, '2021-01-05T15:41:33+01:00'),
    toResource(2, '2021-01-05T15:01:50+01:00', '', specVersion2),
    toResource(1, '2021-01-05T14:59:15+01:00'),
  ],
};
