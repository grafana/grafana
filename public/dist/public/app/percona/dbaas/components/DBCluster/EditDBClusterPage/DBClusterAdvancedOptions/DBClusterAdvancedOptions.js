import { __awaiter } from "tslib";
import { cx } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStyles } from '@grafana/ui/src';
import { Overlay } from 'app/percona/shared/components/Elements/Overlay';
import { NumberInputField } from 'app/percona/shared/components/Form/NumberInput';
import { SelectField } from 'app/percona/shared/components/Form/SelectFieldCore';
import { Databases } from 'app/percona/shared/core';
import { logger } from 'app/percona/shared/helpers/logger';
import validators from 'app/percona/shared/helpers/validators';
import FieldSet from '../../../../../shared/components/Form/FieldSet/FieldSet';
import { CPU, Disk, Memory } from '../../../DBaaSIcons';
import { DBClusterService } from '../../DBCluster.service';
import { getExpectedResourcesDifference, newDBClusterService } from '../../DBCluster.utils';
import { ResourcesBar } from '../../ResourcesBar/ResourcesBar';
import { optionRequired } from '../DBClusterBasicOptions/DBClusterBasicOptions.utils';
import { UnsafeConfigurationWarning } from '../UnsafeConfigurationsWarning/UnsafeConfigurationWarning';
import Configurations from './Configurations/Configurations';
import { DEFAULT_SIZES, EXPECTED_DELAY, MIN_DISK_SIZE, MIN_NODES, MIN_RESOURCES, RECHECK_INTERVAL, RESOURCES_OPTIONS, } from './DBClusterAdvancedOptions.constants';
import { Messages } from './DBClusterAdvancedOptions.messages';
import { getStyles } from './DBClusterAdvancedOptions.styles';
import { AdvancedOptionsFields, DBClusterResources } from './DBClusterAdvancedOptions.types';
import { canGetExpectedResources, nodesValidator, resourceValidator } from './DBClusterAdvancedOptions.utils';
import Templates from './Templates/Templates';
export const DBClusterAdvancedOptions = ({ showUnsafeConfigurationWarning, setShowUnsafeConfigurationWarning, mode, selectedCluster, values, form, }) => {
    let allocatedTimer;
    let expectedTimer;
    const styles = useStyles(getStyles);
    const initialExpected = useRef();
    const [prevResources, setPrevResources] = useState(DBClusterResources.small);
    const [customMemory, setCustomMemory] = useState(selectedCluster ? selectedCluster.memory : DEFAULT_SIZES.small.memory);
    const [customCPU, setCustomCPU] = useState(selectedCluster ? selectedCluster.cpu : DEFAULT_SIZES.small.cpu);
    const [customDisk, setCustomDisk] = useState(DEFAULT_SIZES.small.disk);
    const [allocatedResources, setAllocatedResources] = useState();
    const [loadingAllocatedResources, setLoadingAllocatedResources] = useState(false);
    const [expectedResources, setExpectedResources] = useState();
    const [loadingExpectedResources, setLoadingExpectedResources] = useState(false);
    const mounted = { current: true };
    const { required, min } = validators;
    const { change } = form;
    const diskValidators = [required, min(MIN_DISK_SIZE)];
    const nodeValidators = [required, min(MIN_NODES), nodesValidator];
    const parameterValidators = [required, min(MIN_RESOURCES), resourceValidator];
    const { name, kubernetesCluster, topology, resources, memory, cpu, databaseType, disk, nodes, single } = values;
    const resourcesInputProps = { step: '0.1' };
    const collapsableProps = mode === 'create'
        ? {
            collapsableProps: {
                isOpen: false,
                buttonDataTestId: 'dbCluster-advanced-settings',
            },
        }
        : {};
    const parsePositiveInt = useCallback((value) => (value > 0 && Number.isInteger(+value) ? value : 0), []);
    const resourcesBarStyles = useMemo(() => ({
        [styles.resourcesBar]: !!allocatedResources,
        [styles.resourcesBarEmpty]: !allocatedResources,
    }), [allocatedResources, styles.resourcesBar, styles.resourcesBarEmpty]);
    const getAllocatedResources = (triggerLoading = true) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (allocatedTimer) {
                clearTimeout(allocatedTimer);
            }
            if (triggerLoading) {
                setLoadingAllocatedResources(true);
            }
            const alloc = yield DBClusterService.getAllocatedResources(selectedCluster ? selectedCluster.kubernetesClusterName : kubernetesCluster.value);
            setAllocatedResources(alloc);
        }
        catch (e) {
            logger.error(e);
        }
        finally {
            if (triggerLoading) {
                setLoadingAllocatedResources(false);
            }
            // don't schedule another request if the component was unmounted while the previous request was occuring
            if (mounted.current) {
                // eslint-disable-next-line react-hooks/exhaustive-deps
                allocatedTimer = setTimeout(() => getAllocatedResources(false), RECHECK_INTERVAL);
            }
        }
    });
    useEffect(() => {
        if (prevResources === DBClusterResources.custom) {
            setCustomMemory(memory);
            setCustomCPU(cpu);
            !selectedCluster && setCustomDisk(disk);
        }
        if ((resources === null || resources === void 0 ? void 0 : resources.value) && resources.value !== DBClusterResources.custom) {
            change(AdvancedOptionsFields.cpu, DEFAULT_SIZES[resources.value].cpu);
            change(AdvancedOptionsFields.memory, DEFAULT_SIZES[resources.value].memory);
            !selectedCluster && change(AdvancedOptionsFields.disk, DEFAULT_SIZES[resources.value].disk);
        }
        else {
            change(AdvancedOptionsFields.cpu, customCPU);
            change(AdvancedOptionsFields.memory, customMemory);
            !selectedCluster && change(AdvancedOptionsFields.disk, customDisk);
        }
        setPrevResources(resources === null || resources === void 0 ? void 0 : resources.value);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resources]);
    useEffect(() => {
        if (selectedCluster ? selectedCluster : kubernetesCluster) {
            getAllocatedResources();
        }
        return () => {
            mounted.current = false;
            clearTimeout(allocatedTimer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kubernetesCluster]);
    useEffect(() => {
        const getExpectedResources = () => __awaiter(void 0, void 0, void 0, function* () {
            const dbTypeValue = selectedCluster ? selectedCluster.databaseType : databaseType === null || databaseType === void 0 ? void 0 : databaseType.value;
            try {
                const dbClusterService = newDBClusterService(dbTypeValue);
                setLoadingExpectedResources(true);
                const expected = yield dbClusterService.getExpectedResources({
                    clusterName: selectedCluster ? selectedCluster.clusterName : name,
                    kubernetesClusterName: selectedCluster ? selectedCluster.kubernetesClusterName : kubernetesCluster,
                    databaseType: dbTypeValue,
                    clusterSize: nodes,
                    cpu,
                    memory,
                    disk,
                });
                if (!initialExpected.current) {
                    initialExpected.current = expected;
                }
                setExpectedResources(selectedCluster ? getExpectedResourcesDifference(expected, initialExpected.current) : expected);
            }
            catch (e) {
                logger.error(e);
            }
            finally {
                setLoadingExpectedResources(false);
            }
        });
        if (canGetExpectedResources(selectedCluster ? selectedCluster : kubernetesCluster, values)) {
            if (expectedTimer) {
                clearTimeout(expectedTimer);
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
            expectedTimer = setTimeout(() => getExpectedResources(), EXPECTED_DELAY);
        }
        return () => clearTimeout(expectedTimer);
    }, [memory, cpu, disk, kubernetesCluster, topology, nodes, single, databaseType]);
    useEffect(() => {
        const dbTypeValue = selectedCluster ? selectedCluster.databaseType : databaseType === null || databaseType === void 0 ? void 0 : databaseType.value;
        if (dbTypeValue === Databases.mongodb) {
            setShowUnsafeConfigurationWarning(nodes === 1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseType, nodes]);
    return (React.createElement(FieldSet, Object.assign({ label: Messages.fieldSets.advancedSettings }, collapsableProps),
        React.createElement(React.Fragment, null, showUnsafeConfigurationWarning && React.createElement(UnsafeConfigurationWarning, null)),
        React.createElement(Templates, { k8sClusterName: selectedCluster ? selectedCluster.kubernetesClusterName : kubernetesCluster === null || kubernetesCluster === void 0 ? void 0 : kubernetesCluster.value, databaseType: databaseType === null || databaseType === void 0 ? void 0 : databaseType.value }),
        React.createElement("div", { className: styles.line },
            React.createElement(NumberInputField, { name: AdvancedOptionsFields.nodes, label: Messages.labels.nodes, validators: nodeValidators, parse: parsePositiveInt }),
            React.createElement(SelectField, { name: AdvancedOptionsFields.resources, options: RESOURCES_OPTIONS, label: Messages.labels.resources, validate: optionRequired, defaultValue: false })),
        React.createElement("div", { className: styles.resourcesWrapper },
            React.createElement("div", { className: styles.resourcesInputCol },
                React.createElement(NumberInputField, { name: AdvancedOptionsFields.cpu, label: Messages.labels.cpu, validators: parameterValidators, disabled: (resources === null || resources === void 0 ? void 0 : resources.value) !== DBClusterResources.custom, inputProps: resourcesInputProps }),
                React.createElement(NumberInputField, { name: AdvancedOptionsFields.memory, label: Messages.labels.memory, validators: parameterValidators, disabled: (resources === null || resources === void 0 ? void 0 : resources.value) !== DBClusterResources.custom, inputProps: resourcesInputProps }),
                React.createElement(NumberInputField, { name: AdvancedOptionsFields.disk, label: Messages.labels.disk, validators: diskValidators, disabled: selectedCluster ? true : (resources === null || resources === void 0 ? void 0 : resources.value) !== DBClusterResources.custom, parse: parsePositiveInt })),
            React.createElement("div", { className: styles.resourcesBarCol },
                React.createElement(Overlay, { isPending: loadingAllocatedResources || loadingExpectedResources },
                    React.createElement(ResourcesBar, { resourceLabel: Messages.labels.cpu, icon: React.createElement(CPU, null), total: allocatedResources === null || allocatedResources === void 0 ? void 0 : allocatedResources.total.cpu, allocated: allocatedResources === null || allocatedResources === void 0 ? void 0 : allocatedResources.allocated.cpu, expected: expectedResources === null || expectedResources === void 0 ? void 0 : expectedResources.expected.cpu, className: cx(resourcesBarStyles), dataTestId: "dbcluster-resources-bar-cpu" }),
                    React.createElement(ResourcesBar, { resourceLabel: Messages.labels.memory, icon: React.createElement(Memory, null), total: allocatedResources === null || allocatedResources === void 0 ? void 0 : allocatedResources.total.memory, allocated: allocatedResources === null || allocatedResources === void 0 ? void 0 : allocatedResources.allocated.memory, expected: expectedResources === null || expectedResources === void 0 ? void 0 : expectedResources.expected.memory, className: cx(resourcesBarStyles), dataTestId: "dbcluster-resources-bar-memory" }),
                    React.createElement(ResourcesBar, { resourceLabel: Messages.labels.disk, resourceEmptyValueMessage: "Information about free disk space on the Kubernetes cluster is unavailable", icon: React.createElement(Disk, null), total: allocatedResources === null || allocatedResources === void 0 ? void 0 : allocatedResources.total.disk, allocated: allocatedResources === null || allocatedResources === void 0 ? void 0 : allocatedResources.allocated.disk, expected: expectedResources === null || expectedResources === void 0 ? void 0 : expectedResources.expected.disk, className: styles.resourcesBarLast, dataTestId: "dbcluster-resources-bar-disk" })))),
        React.createElement(Configurations, { databaseType: selectedCluster ? selectedCluster.databaseType : databaseType === null || databaseType === void 0 ? void 0 : databaseType.value, k8sClusterName: selectedCluster ? selectedCluster.kubernetesClusterName : kubernetesCluster === null || kubernetesCluster === void 0 ? void 0 : kubernetesCluster.value, mode: mode, form: form })));
};
//# sourceMappingURL=DBClusterAdvancedOptions.js.map