import React from 'react';
import { AsyncSelectFieldCore } from 'app/percona/shared/components/Form/AsyncSelectFieldCore';
import { AdvancedOptionsFields } from '../DBClusterAdvancedOptions.types';
import { Messages } from './Templates.messages';
import { TemplatesService } from './Templates.service';
export const Templates = ({ k8sClusterName, databaseType }) => {
    return (React.createElement(AsyncSelectFieldCore, { name: AdvancedOptionsFields.template, label: Messages.labels.templates, loadOptions: () => TemplatesService.loadTemplatesOptions(k8sClusterName, databaseType), defaultOptions: true }));
};
export default Templates;
//# sourceMappingURL=Templates.js.map