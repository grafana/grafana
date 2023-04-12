export const Messages = {
  services: {
    add: 'Add Service',
    columns: {
      status: 'Status',
      serviceName: 'Service Name',
      nodeName: 'Node Name',
      monitoring: 'Monitoring',
      address: 'Address',
      port: 'Port',
    },
    actions: {
      dashboard: 'Dashboard',
      qan: 'QAN',
    },
    details: {
      agents: 'Agents',
      serviceId: 'Service ID',
      labels: 'Labels',
    },
    emptyTable: 'No services available',
    forceConfirmation: 'Force mode is going to delete all associated agents',
    deleteConfirmation: (nrItems: number) =>
      `Are you sure that you want to permanently delete ${nrItems} service${nrItems ? 's' : ''}`,
    servicesDeleted: (deletedItems: number, totalItems: number) =>
      `${deletedItems} of ${totalItems} services successfully deleted`,
  },
  agents: {
    goBack: 'Go back to services',
    breadcrumbLeft: (serviceName: string) => `Service ${serviceName}`,
    breadcrumbRight: ` / Agents`,
    emptyTable: 'No agents available',
    deleteConfirmation: (nrItems: number) =>
      `Are you sure that you want to permanently delete ${nrItems} agent${nrItems ? 's' : ''}`,
    agentsDeleted: (deletedItems: number, totalItems: number) =>
      `${deletedItems} of ${totalItems} agents successfully deleted`,
    forceConfirmation: 'Force mode is going to delete all associated agents',
    columns: {
      status: 'Status',
      agentType: 'Agent Type',
      agentId: 'Agent ID',
    },
    details: {
      properties: 'Properties',
    },
  },
  nodes: {
    forceConfirmation: 'Force mode is going to delete all agents and services associated with the nodes',
    emptyTable: 'No nodes available',
    columns: {
      nodeName: 'Node Name',
      nodeId: 'Node ID',
      nodeType: 'Node Type',
      address: 'Address',
    },
    deleteConfirmation: (nrItems: number) =>
      `Are you sure that you want to permanently delete ${nrItems} node${nrItems ? 's' : ''}`,
    nodesDeleted: (deletedItems: number, totalItems: number) =>
      `${deletedItems} of ${totalItems} nodes successfully deleted`,
  },
  delete: 'Delete',
  cancel: 'Cancel',
  proceed: 'Proceed',
  forceMode: 'Force mode',
  confirmAction: 'Confirm action',
};
