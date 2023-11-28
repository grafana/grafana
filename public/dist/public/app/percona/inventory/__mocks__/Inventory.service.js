export const stubWithLabels = {
    service_id: 'service_id',
    service_name: 'mysql-with-labels',
    node_id: 'node_id',
    address: 'mysql',
    port: 3306,
    environment: 'Env',
    cluster: 'Clu',
    replication_set: 'Repl',
    custom_labels: {
        label: 'value',
        label2: 'value2',
    },
};
export const stubs = {
    mysql: [
        {
            id: 'service_1',
            name: 'Service 1',
        },
        {
            id: 'service_2',
            name: 'Service 2',
        },
    ],
};
export const InventoryService = jest.genMockFromModule('app/percona/inventory/Inventory.service').InventoryService;
InventoryService.getDbServices = () => Promise.resolve(stubs);
InventoryService.getService = () => Promise.resolve({
    mysql: stubWithLabels,
});
//# sourceMappingURL=Inventory.service.js.map