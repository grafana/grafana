import { SelectableValue } from '@grafana/data';

import { Databases } from '../../../../../../shared/core';
import { DBClusterService } from '../../../DBCluster.service';
import { DatabaseToDBClusterTypeMapping } from '../../../DBCluster.types';

export const TemplatesService = {
  async loadTemplatesOptions(k8sClusterName: string, databaseType: Databases): Promise<Array<SelectableValue<string>>> {
    const dbClusterType = DatabaseToDBClusterTypeMapping[databaseType];
    const templatesResponse =
      dbClusterType && (await DBClusterService.getDBClusterTemplates(k8sClusterName, dbClusterType));
    const templates = templatesResponse?.templates || [];
    return templates.map((template) => ({
      label: template.name,
      value: template.kind,
    }));
  },
};
