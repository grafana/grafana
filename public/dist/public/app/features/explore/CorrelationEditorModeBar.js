import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { Prompt } from 'react-router-dom';
import { useBeforeUnload, useUnmount } from 'react-use';
import { colorManipulator } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Button, HorizontalGroup, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { CORRELATION_EDITOR_POST_CONFIRM_ACTION, useDispatch, useSelector } from 'app/types';
import { CorrelationUnsavedChangesModal } from './CorrelationUnsavedChangesModal';
import { saveCurrentCorrelation } from './state/correlations';
import { changeDatasource } from './state/datasource';
import { changeCorrelationHelperData } from './state/explorePane';
import { changeCorrelationEditorDetails, splitClose } from './state/main';
import { runQueries } from './state/query';
import { selectCorrelationDetails } from './state/selectors';
export const CorrelationEditorModeBar = ({ panes }) => {
    const dispatch = useDispatch();
    const styles = useStyles2(getStyles);
    const correlationDetails = useSelector(selectCorrelationDetails);
    const [showSavePrompt, setShowSavePrompt] = useState(false);
    // handle refreshing and closing the tab
    useBeforeUnload((correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.dirty) || false, 'Save correlation?');
    // handle exiting (staying within explore)
    useEffect(() => {
        if ((correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.isExiting) && (correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.dirty)) {
            setShowSavePrompt(true);
        }
        else if ((correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.isExiting) && !(correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.dirty)) {
            dispatch(changeCorrelationEditorDetails({
                editorMode: false,
                dirty: false,
                isExiting: false,
            }));
        }
    }, [correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.dirty, correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.isExiting, dispatch]);
    // clear data when unmounted
    useUnmount(() => {
        dispatch(changeCorrelationEditorDetails({
            editorMode: false,
            isExiting: false,
            dirty: false,
            label: undefined,
            description: undefined,
            canSave: false,
        }));
        panes.forEach((pane) => {
            dispatch(changeCorrelationHelperData({
                exploreId: pane[0],
                correlationEditorHelperData: undefined,
            }));
            dispatch(runQueries({ exploreId: pane[0] }));
        });
    });
    const closePaneAndReset = (exploreId) => {
        setShowSavePrompt(false);
        dispatch(splitClose(exploreId));
        reportInteraction('grafana_explore_split_view_closed');
        dispatch(changeCorrelationEditorDetails({
            editorMode: true,
            isExiting: false,
            dirty: false,
            label: undefined,
            description: undefined,
            canSave: false,
        }));
        panes.forEach((pane) => {
            dispatch(changeCorrelationHelperData({
                exploreId: pane[0],
                correlationEditorHelperData: undefined,
            }));
            dispatch(runQueries({ exploreId: pane[0] }));
        });
    };
    const changeDatasourceAndReset = (exploreId, datasourceUid) => {
        setShowSavePrompt(false);
        dispatch(changeDatasource(exploreId, datasourceUid, { importQueries: true }));
        dispatch(changeCorrelationEditorDetails({
            editorMode: true,
            isExiting: false,
            dirty: false,
            label: undefined,
            description: undefined,
            canSave: false,
        }));
        panes.forEach((pane) => {
            dispatch(changeCorrelationHelperData({
                exploreId: pane[0],
                correlationEditorHelperData: undefined,
            }));
        });
    };
    const saveCorrelation = (skipPostConfirmAction) => {
        dispatch(saveCurrentCorrelation(correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.label, correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.description));
        if (!skipPostConfirmAction && (correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.postConfirmAction) !== undefined) {
            const { exploreId, action, changeDatasourceUid } = correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.postConfirmAction;
            if (action === CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_PANE) {
                closePaneAndReset(exploreId);
            }
            else if (action === CORRELATION_EDITOR_POST_CONFIRM_ACTION.CHANGE_DATASOURCE &&
                changeDatasourceUid !== undefined) {
                changeDatasourceAndReset(exploreId, changeDatasourceUid);
            }
        }
        else {
            dispatch(changeCorrelationEditorDetails({ editorMode: false, dirty: false, isExiting: false }));
        }
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(Prompt, { message: (location) => {
                if (location.pathname !== '/explore' &&
                    ((correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.editorMode) || false) &&
                    ((correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.dirty) || false)) {
                    return 'You have unsaved correlation data. Continue?';
                }
                else {
                    return true;
                }
            } }),
        showSavePrompt && (React.createElement(CorrelationUnsavedChangesModal, { onDiscard: () => {
                if ((correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.postConfirmAction) !== undefined) {
                    const { exploreId, action, changeDatasourceUid } = correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.postConfirmAction;
                    if (action === CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_PANE) {
                        closePaneAndReset(exploreId);
                    }
                    else if (action === CORRELATION_EDITOR_POST_CONFIRM_ACTION.CHANGE_DATASOURCE &&
                        changeDatasourceUid !== undefined) {
                        changeDatasourceAndReset(exploreId, changeDatasourceUid);
                    }
                }
                else {
                    // exit correlations mode
                    // if we are discarding the in progress correlation, reset everything
                    // this modal only shows if the editorMode is false, so we just need to update the dirty state
                    dispatch(changeCorrelationEditorDetails({
                        editorMode: false,
                        dirty: false,
                        isExiting: false,
                    }));
                }
            }, onCancel: () => {
                // if we are cancelling the exit, set the editor mode back to true and hide the prompt
                dispatch(changeCorrelationEditorDetails({ isExiting: false }));
                setShowSavePrompt(false);
            }, onSave: () => {
                saveCorrelation(false);
            } })),
        React.createElement("div", { className: styles.correlationEditorTop },
            React.createElement(HorizontalGroup, { spacing: "md", justify: "flex-end" },
                React.createElement(Tooltip, { content: "Correlations editor in Explore is an experimental feature." },
                    React.createElement(Icon, { className: styles.iconColor, name: "info-circle", size: "xl" })),
                React.createElement(Button, { variant: "secondary", disabled: !(correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.canSave), fill: "outline", className: (correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.canSave) ? styles.buttonColor : styles.disabledButtonColor, onClick: () => {
                        saveCorrelation(true);
                    } }, "Save"),
                React.createElement(Button, { variant: "secondary", fill: "outline", className: styles.buttonColor, icon: "times", onClick: () => {
                        dispatch(changeCorrelationEditorDetails({ isExiting: true }));
                        reportInteraction('grafana_explore_correlation_editor_exit_pressed');
                    } }, "Exit correlation editor")))));
};
const getStyles = (theme) => {
    const contrastColor = theme.colors.getContrastText(theme.colors.primary.main);
    const lighterBackgroundColor = colorManipulator.lighten(theme.colors.primary.main, 0.1);
    const darkerBackgroundColor = colorManipulator.darken(theme.colors.primary.main, 0.2);
    const disabledColor = colorManipulator.darken(contrastColor, 0.2);
    return {
        correlationEditorTop: css({
            backgroundColor: theme.colors.primary.main,
            marginTop: '3px',
            padding: theme.spacing(1),
        }),
        iconColor: css({
            color: contrastColor,
        }),
        buttonColor: css({
            color: contrastColor,
            borderColor: contrastColor,
            '&:hover': {
                color: contrastColor,
                borderColor: contrastColor,
                backgroundColor: lighterBackgroundColor,
            },
        }),
        // important needed to override disabled state styling
        disabledButtonColor: css({
            color: `${disabledColor} !important`,
            backgroundColor: `${darkerBackgroundColor} !important`,
        }),
    };
};
//# sourceMappingURL=CorrelationEditorModeBar.js.map