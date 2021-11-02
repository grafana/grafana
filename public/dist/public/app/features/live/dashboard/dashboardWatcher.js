import { getGrafanaLiveSrv, locationService } from '@grafana/runtime';
import { getDashboardSrv } from '../../dashboard/services/DashboardSrv';
import { appEvents, contextSrv } from 'app/core/core';
import { AppEvents, isLiveChannelMessageEvent, isLiveChannelStatusEvent, LiveChannelConnectionState, LiveChannelScope, } from '@grafana/data';
import { DashboardChangedModal } from './DashboardChangedModal';
import { DashboardEventAction } from './types';
import { sessionId } from 'app/features/live';
import { ShowModalReactEvent } from '../../../types/events';
var DashboardWatcher = /** @class */ (function () {
    function DashboardWatcher() {
        var _this = this;
        this.editing = false;
        this.observer = {
            next: function (event) {
                // Send the editing state when connection starts
                if (isLiveChannelStatusEvent(event) && _this.editing && event.state === LiveChannelConnectionState.Connected) {
                    _this.sendEditingState();
                }
                if (isLiveChannelMessageEvent(event)) {
                    if (event.message.sessionId === sessionId) {
                        return; // skip internal messages
                    }
                    var action = event.message.action;
                    switch (action) {
                        case DashboardEventAction.EditingStarted:
                        case DashboardEventAction.Saved: {
                            if (_this.ignoreSave) {
                                _this.ignoreSave = false;
                                return;
                            }
                            var dash = getDashboardSrv().getCurrent();
                            if ((dash === null || dash === void 0 ? void 0 : dash.uid) !== event.message.uid) {
                                console.log('dashboard event for different dashboard?', event, dash);
                                return;
                            }
                            var showPopup = _this.editing || dash.hasUnsavedChanges();
                            if (action === DashboardEventAction.Saved) {
                                if (showPopup) {
                                    appEvents.publish(new ShowModalReactEvent({
                                        component: DashboardChangedModal,
                                        props: { event: event },
                                    }));
                                }
                                else {
                                    appEvents.emit(AppEvents.alertSuccess, ['Dashboard updated']);
                                    _this.reloadPage();
                                }
                            }
                            else if (showPopup) {
                                if (action === DashboardEventAction.EditingStarted && !_this.hasSeenNotice) {
                                    var editingEvent = event.message;
                                    var recent = _this.getRecentEditingEvent();
                                    if (!recent || recent.message !== editingEvent.message) {
                                        _this.hasSeenNotice = true;
                                        appEvents.emit(AppEvents.alertWarning, [
                                            'Another session is editing this dashboard',
                                            editingEvent.message,
                                        ]);
                                    }
                                    _this.lastEditing = editingEvent;
                                }
                            }
                            return;
                        }
                    }
                }
            },
        };
    }
    DashboardWatcher.prototype.setEditingState = function (state) {
        var changed = (this.editing = state);
        this.editing = state;
        this.hasSeenNotice = false;
        if (changed && contextSrv.isEditor) {
            this.sendEditingState();
        }
    };
    DashboardWatcher.prototype.sendEditingState = function () {
        var _a = this, channel = _a.channel, uid = _a.uid;
        if (channel && uid) {
            getGrafanaLiveSrv().publish(channel, {
                sessionId: sessionId,
                uid: uid,
                action: this.editing ? DashboardEventAction.EditingStarted : DashboardEventAction.EditingCanceled,
                timestamp: Date.now(),
            });
        }
    };
    DashboardWatcher.prototype.watch = function (uid) {
        var live = getGrafanaLiveSrv();
        if (!live) {
            return;
        }
        // Check for changes
        if (uid !== this.uid) {
            this.channel = {
                scope: LiveChannelScope.Grafana,
                namespace: 'dashboard',
                path: "uid/" + uid,
            };
            this.leave();
            if (uid) {
                this.subscription = live.getStream(this.channel).subscribe(this.observer);
            }
            this.uid = uid;
        }
    };
    DashboardWatcher.prototype.leave = function () {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
        this.subscription = undefined;
        this.uid = undefined;
    };
    DashboardWatcher.prototype.ignoreNextSave = function () {
        this.ignoreSave = true;
    };
    DashboardWatcher.prototype.getRecentEditingEvent = function () {
        if (this.lastEditing && this.lastEditing.timestamp) {
            var elapsed = Date.now() - this.lastEditing.timestamp;
            if (elapsed > 5000) {
                this.lastEditing = undefined;
            }
        }
        return this.lastEditing;
    };
    DashboardWatcher.prototype.reloadPage = function () {
        locationService.reload();
    };
    return DashboardWatcher;
}());
export var dashboardWatcher = new DashboardWatcher();
export function getDashboardChannelsFeature() {
    return {
        name: 'dashboard',
        support: {
            getChannelConfig: function (path) { return ({
                description: 'Dashboard change events',
                hasPresence: true,
            }); },
        },
        description: 'Dashboard listener',
    };
}
//# sourceMappingURL=dashboardWatcher.js.map