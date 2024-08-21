import { css } from "@emotion/css";
import { useEffect, useMemo, useState } from "react";

import { GrafanaTheme2 } from "@grafana/data";
import { config } from '@grafana/runtime';
import { Checkbox, ConfirmModal, EmptyState, Icon, Spinner, Tooltip, useStyles2 } from "@grafana/ui";

import { useInstall, useInstallStatus } from "../state/hooks";
import { CatalogPlugin } from "../types"


type UpdateError = {
    id: string;
    message: string;
}

function getIcon({ id, installedPlugins, inProgress, errorMap, selectedPlugins }:
    { id: string, installedPlugins: Set<string>, inProgress: boolean, errorMap: Map<string, UpdateError>, selectedPlugins?: Set<string> }) {

    if (errorMap && errorMap.has(id)) {
        return (
            <Tooltip content={`Error updating plugin: ${errorMap.get(id)?.message}. Close the modal and try again.`}>
                <Icon size="xl" name="exclamation-circle" />
            </Tooltip>
        )
    }
    if (inProgress && selectedPlugins?.has(id)) {
        return <Spinner />;
    }
    if (installedPlugins.has(id)) {
        return <Icon size="xl" name="check" />;
    }
    return '';
}


const getStyles = (theme: GrafanaTheme2) => ({
    table: css({
        marginTop: theme.spacing(2),
        width: '100%',
        borderCollapse: 'collapse',
    }),
    tableRow: css({
        borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    icon: css({
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    }),
    header: css({
        textAlign: 'left',
        padding: theme.spacing(1),
        borderBottom: `2px solid ${theme.colors.border.strong}`,
    }),
    data: css({
        padding: '10px',
    }),
    footer: css({
        fontSize: theme.typography.bodySmall.fontSize,
        marginTop: theme.spacing(3),
    }),
    noPluginsMessage: css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%'
    }),
    tableBody: css({
        overflowY: 'auto',
        height: theme.spacing(19),
    }),
    modalContainer: css({
        height: theme.spacing(41),
    }),
});

type ModalBodyProps = {
    installedPlugins: Set<string>,
    plugins: CatalogPlugin[],
    inProgress: boolean,
    selectedPlugins?: Set<string>,
    onCheckboxChange: (id: string) => void,
    errorMap: Map<string, UpdateError>
}

const ModalBody = ({
    installedPlugins,
    plugins,
    inProgress,
    selectedPlugins,
    onCheckboxChange,
    errorMap
}: ModalBodyProps) => {
    const styles = useStyles2(getStyles);

    return (
        <div className={styles.modalContainer}>
            {plugins.length === 0 ? (
                <EmptyState variant="completed" message={'All plugins updated!'} />
            ) : (
                <>
                    <div>The following plugins have update available</div>
                    <div >
                        <table className={styles.table}>
                            <thead className={styles.header}>
                                <tr>
                                    <th>Update</th>
                                    <th>Name</th>
                                    <th>Installed</th>
                                    <th>Available</th>
                                    <th></th>
                                </tr>
                            </thead>
                        </table>
                        <div className={styles.tableBody}>
                            <table className={styles.table}>
                                <tbody>
                                    {plugins.map(({ id, name, installedVersion, latestVersion }: CatalogPlugin) => (
                                        <tr key={id} className={styles.tableRow}>
                                            <td>
                                                <Checkbox onChange={() => onCheckboxChange(id)} value={selectedPlugins?.has(id)} disabled={installedPlugins.has(id)} />
                                            </td>
                                            <td>{name}</td>
                                            <td>{installedPlugins.has(id) ? latestVersion : installedVersion}</td>
                                            <td>{latestVersion}</td>
                                            <td className={styles.icon}>{getIcon({ id, installedPlugins, inProgress, errorMap, selectedPlugins })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {config.pluginAdminExternalManageEnabled && config.featureToggles.managedPluginsInstall && (
                        <footer className={styles.footer}>* It may take a few minutes for the plugins to be available for usage.</footer>
                    )}
                    <footer className={styles.footer}>* It may take a few minutes for the plugins to be available for usage.</footer>
                </>
            )}
        </div>
    );
};

type Props = {
    isOpen: boolean;
    onDismiss: () => void;
    plugins: CatalogPlugin[];
}

export const UpdateAllModal = ({ isOpen, onDismiss, plugins }: Props) => {
    const install = useInstall();
    const { error } = useInstallStatus()
    const [errorMap, setErrorMap] = useState(new Map<string, UpdateError>());
    const [inProgress, setInProgress] = useState(false);
    const [selectedPlugins, setSelectedPlugins] = useState<Set<string>>();
    const [installedPlugins, setInstalledPlugins] = useState<Set<string>>(new Set());

    const pluginsSet = useMemo(() => new Set(plugins.map((plugin) => plugin.id)), [plugins]);
    const installsRemaining = plugins.length;

    // Updates the component state on every plugins change, since the installation will change the store content
    useEffect(() => {
        if (inProgress) {
            selectedPlugins?.forEach(id => {
                if (!pluginsSet.has(id) && !installedPlugins.has(id)) {
                    setSelectedPlugins((prevSelectedPlugins) => {
                        const newSelectedPlugins = new Set(prevSelectedPlugins);
                        newSelectedPlugins.delete(id);
                        return newSelectedPlugins;
                    });

                    setInstalledPlugins((prevInstalledPlugins) => {
                        const newInstalledPlugins = new Set(prevInstalledPlugins);
                        newInstalledPlugins.add(id);
                        return newInstalledPlugins;
                    });
                }
            });

            if (selectedPlugins?.size === 0) {
                setInProgress(false);
            }
        }
    }, [installedPlugins, inProgress, pluginsSet, selectedPlugins]);

    // Initialize the component with all the plugins selected
    useEffect(() => {
        if (selectedPlugins === undefined && (plugins.length > 0)) {
            const initialSelectedPlugins = new Set(plugins.map(plugin => plugin.id));
            setSelectedPlugins(initialSelectedPlugins);
        }

    }, [plugins, selectedPlugins]);

    // Updates the component state on every error that comes from the store
    useEffect(() => {
        if (inProgress && error && !errorMap.has(error.id) && selectedPlugins?.has(error.id)) {
            setErrorMap(prevErrorMap => {
                const newErrorMap = new Map(prevErrorMap);
                newErrorMap.set(error.id, error);
                return newErrorMap;
            });

            setSelectedPlugins((prevSelectedPlugins) => {
                const newSelectedPlugins = new Set(prevSelectedPlugins);
                newSelectedPlugins.delete(error.id);
                return newSelectedPlugins;
            });
        }
    }, [error, errorMap, inProgress, selectedPlugins]);

    const onConfirm = () => {
        if (!inProgress) {
            setInProgress(true);
            plugins.forEach(plugin => {
                if (selectedPlugins?.has(plugin.id) && !installedPlugins.has(plugin.id)) {
                    install(plugin.id, plugin.latestVersion, true);
                }
            });
        }
    }

    const onDismissClick = () => {
        setErrorMap(new Map());
        setInProgress(false);
        setSelectedPlugins(undefined);
        setInstalledPlugins(new Set());
        onDismiss();
    }

    const onCheckboxChange = (id: string) => {
        setSelectedPlugins(prevSelectedPlugins => {
            const newSelectedPlugins = new Set(prevSelectedPlugins);
            if (newSelectedPlugins.has(id)) {
                newSelectedPlugins.delete(id);
            } else {
                newSelectedPlugins.add(id);
            }
            return newSelectedPlugins;
        });
        if (errorMap.has(id)) {
            setErrorMap(prevErrorMap => {
                const newErrorMap = new Map(prevErrorMap);
                newErrorMap.delete(id);
                return newErrorMap;
            });
        }
    }


    return <ConfirmModal
        isOpen={isOpen}
        title="Update Plugins"
        body={<ModalBody
            installedPlugins={installedPlugins}
            plugins={plugins}
            inProgress={inProgress}
            errorMap={errorMap}
            onCheckboxChange={onCheckboxChange}
            selectedPlugins={selectedPlugins}
        />}
        onConfirm={installsRemaining > 0 ? onConfirm : onDismissClick}
        onDismiss={onDismissClick}
        disabled={selectedPlugins?.size === 0 || inProgress}
        confirmText={installsRemaining > 0 ? `Update (${selectedPlugins?.size})` : "Close"}
    />
}

export default UpdateAllModal;
