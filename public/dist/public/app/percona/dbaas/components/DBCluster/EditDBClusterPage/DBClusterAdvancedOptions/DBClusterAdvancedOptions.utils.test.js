import { canGetExpectedResources, resourceValidator } from './DBClusterAdvancedOptions.utils';
describe('EditDBClusterAdvancedOptions.utils::', () => {
    describe('resourceValidator::', () => {
        it('returns undefined on undefined value', () => {
            expect(resourceValidator(undefined)).toBeUndefined();
        });
        it('returns undefined when value is integer', () => {
            expect(resourceValidator(10)).toBeUndefined();
        });
        it('returns undefined when has one decimal place', () => {
            expect(resourceValidator(2.5)).toBeUndefined();
        });
        it("doesn't return undefined when value has more than one decimal place", () => {
            expect(resourceValidator(3.74)).not.toBeUndefined();
        });
    });
    describe('canGetExpectedResources::', () => {
        const kubernetesCluster = {
            value: 'test',
            label: 'test',
        };
        const values = {
            memory: 2,
            cpu: 4,
            disk: 20,
            nodes: 3,
        };
        it('returns false when memory is undefined', () => {
            expect(canGetExpectedResources(kubernetesCluster, Object.assign(Object.assign({}, values), { memory: undefined }))).toBeFalsy();
        });
        it('returns false when cpu is less than zero', () => {
            expect(canGetExpectedResources(kubernetesCluster, Object.assign(Object.assign({}, values), { cpu: -1 }))).toBeFalsy();
        });
        it('returns false when topology is cluster but nodes is undefined or a string', () => {
            expect(canGetExpectedResources(kubernetesCluster, Object.assign(Object.assign({}, values), { nodes: undefined }))).toBeFalsy();
            expect(canGetExpectedResources(kubernetesCluster, Object.assign(Object.assign({}, values), { nodes: 'test_invalid_nodes' }))).toBeFalsy();
        });
        it('returns true when topology is cluster and nodes is a positive number', () => {
            expect(canGetExpectedResources(kubernetesCluster, Object.assign(Object.assign({}, values), { nodes: -3 }))).toBeFalsy();
            expect(canGetExpectedResources(kubernetesCluster, Object.assign(Object.assign({}, values), { nodes: 2 }))).toBeTruthy();
            expect(canGetExpectedResources(kubernetesCluster, Object.assign(Object.assign({}, values), { nodes: '7' }))).toBeTruthy();
        });
    });
});
//# sourceMappingURL=DBClusterAdvancedOptions.utils.test.js.map