import React from 'react';

import { Button, Modal } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import config from 'app/core/config';

import { AdminFeatureTogglesTable } from './AdminFeatureTogglesTable';


type FeatureToggles = typeof config.featureToggles;

type FeatureToggle = {
    name: string;
    enabled: boolean;
    readonly: boolean;
}

export default function AdminFeatureTogglesPage() {
    const featureTogglesArray = Object.keys(config.featureToggles).map((name) => {
        return {
            name,
            enabled: config.featureToggles[name as keyof FeatureToggles],
            readonly: Math.random() > 0.5,
        };
    }) as FeatureToggle[];
    const [featureToggles, setFeatureToggles] = React.useState<FeatureToggle[]>(featureTogglesArray);
    const [previousToggleState, setPreviousToggleState] = React.useState<FeatureToggle[]>(featureTogglesArray);
    const [showDialog, setShowDialog] = React.useState(false);

    const handleToggleChange = (featureToggle: FeatureToggle, enabled: boolean) => {


        setFeatureToggles((prevToggles: FeatureToggle[]) =>
            prevToggles.map((toggle: FeatureToggle) =>
                toggle.name === featureToggle.name
                    ? { ...toggle, enabled }
                    : toggle
            )
        );

    };
    const calculateTogglesDifference = () => {
        return featureToggles.map((toggle: FeatureToggle) => {
            const previousToggle = previousToggleState.find((previousToggle: FeatureToggle) => previousToggle.name === toggle.name);
            return {
                name: toggle.name,
                currentEnabled: toggle.enabled,
                previousEnabled: previousToggle?.enabled
            };
        }).filter(toggle => toggle.currentEnabled !== toggle.previousEnabled);
    }

    const togglesChanged = calculateTogglesDifference();

    const displayDialog = () => {
        setShowDialog(!showDialog);
    }

    const saveChanges = () => {
        setPreviousToggleState(featureToggles);
        setShowDialog(!showDialog);
    }

    return (
        <Page navId="feature-toggles">
            <Page.Contents>
                <>
                    <Modal isOpen={showDialog} title="Confirm changes" onDismiss={displayDialog}>
                        <div>
                            <p>Are you sure you want to save the following changes?</p>

                            <table className="filter-table form-inline filter-table--hover">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Previous State</th>
                                        <th>New State</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {calculateTogglesDifference().map((toggle) => (
                                        <tr key={toggle.name}>
                                            <td>
                                                <div>{toggle.name}</div>
                                            </td>
                                            <td>
                                                <div>
                                                    {toggle.previousEnabled ? 'enabled' : 'disabled'}
                                                </div>
                                            </td>
                                            <td>
                                                <div>
                                                    {toggle.currentEnabled ? 'enabled' : 'disabled'}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p></p>

                            <p>These changes will take effect after the Grafana instance is restarted. By clicking the save button, you acknowledge that the Grafana instance will be restarted. Please make sure you have reviewed each feature toggle&apos;s relevant documentation before altering it&apos;s state</p>

                        </div>
                        <Modal.ButtonRow>
                            <Button variant="secondary" onClick={displayDialog}>Cancel</Button>
                            <Button type="button" onClick={saveChanges}>Save and restart instance</Button>
                        </Modal.ButtonRow>
                    </Modal>
                    <div className="page-action-bar">
                        <div className="page-action-bar__spacer" />
                        <Button onClick={displayDialog} disabled={togglesChanged.length === 0}>
                            Save
                        </Button>
                    </div>


                    <AdminFeatureTogglesTable
                        featureToggles={featureToggles}
                        onToggleChange={handleToggleChange}
                    />

                </>
            </Page.Contents>
        </Page>
    );
}

