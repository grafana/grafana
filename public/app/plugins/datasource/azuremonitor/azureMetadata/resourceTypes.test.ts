import { resourceTypeDisplayNames, resourceTypes } from './resourceTypes';

describe('Azure Monitor metric resource types', () => {
  it.each([
    { type: 'microsoft.app/sessionpools', label: 'Container Apps session pools' },
    { type: 'microsoft.azurestackhci/edgemachines', label: 'Azure Stack HCI edge machines' },
    { type: 'microsoft.durabletask/schedulers', label: 'Durable Task schedulers' },
    { type: 'microsoft.horizondb/clusters', label: 'Azure HorizonDB clusters' },
    { type: 'microsoft.iotfirmwaredefense/workspaces', label: 'IoT firmware analysis workspaces' },
    { type: 'microsoft.managednetworkfabric/networkfabriccontrollers', label: 'Network fabric controllers' },
    { type: 'microsoft.managednetworkfabric/networkfabrics', label: 'Network fabrics' },
    { type: 'microsoft.monitor/pipelinegroups', label: 'Azure Monitor pipeline groups' },
    { type: 'microsoft.network/networksecurityperimeters', label: 'Network security perimeters' },
    { type: 'microsoft.openenergyplatform/energyservices', label: 'Azure OpenEnergy' },
    { type: 'microsoft.quantum/provideraccounts', label: 'Azure Quantum provider accounts' },
    { type: 'oracle.database/goldengatedeployments', label: 'Oracle GoldenGate deployments' },
  ])('includes $type in fallback discovery with a readable label', ({ type, label }) => {
    expect(resourceTypes).toContain(type);
    expect(resourceTypeDisplayNames[type]).toBe(label);
  });
});
