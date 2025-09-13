import { Factory } from 'fishery';

import { AlertingEntityMetadataAnnotations } from '../../api.gen';

export const AlertingEntityMetadataAnnotationsFactory = Factory.define<AlertingEntityMetadataAnnotations>(() => ({
  'grafana.com/access/canAdmin': 'true',
  'grafana.com/access/canDelete': 'true',
  'grafana.com/access/canWrite': 'true',
  'grafana.com/provenance': '',
}));
