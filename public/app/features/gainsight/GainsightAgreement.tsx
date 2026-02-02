import { isEqual as _isEqual, cloneDeep } from 'lodash';
import React, { Component } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import './dist/adapt-agreement.js';

import { AppEvents } from '@grafana/data';
import { Link } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createInfoNotification } from 'app/core/copy/appNotification';
import { updateGainSightUserPreferences } from 'app/features/dashboard/state/reducers';
import { store } from 'app/store/store';
import { StoreState, ThunkDispatch } from 'app/types';

import { appEvents } from '../../core/core';
import { autoUpdateGainsightUserPreferences, Preference, setImsUserPreferences } from '../../core/services/ims_srv';
import { isOrgAdmin } from '../plugins/admin/permissions';

const mapStateToProps = (state: StoreState) => ({
  preferences: state.dashboard.gainSightUserPreferences,
});

const mapDispatchToProps = (dispatch: ThunkDispatch) => {
  return {
    updatePreferences: (prefs: Preference[]) => {
      dispatch(updateGainSightUserPreferences(prefs));
    },
  };
};
const connector = connect(mapStateToProps, mapDispatchToProps);
interface OwnProps {
  isModal: boolean;
}
interface Props extends OwnProps, ConnectedProps<typeof connector> {}

interface OwnState {
  userType: string;
  isModalOpen: boolean;
  preferences: Preference[];
  previousPrefs: Preference[];
  initialLoading: boolean;
  showAgreement: boolean;
}

class GainsightAgreement extends Component<Props, OwnState> {
  adaptAgreementRef: any;
  constructor(props: any) {
    super(props);
    this.adaptAgreementRef = React.createRef();
    this.state = {
      userType: isOrgAdmin() ? 'TENANT' : 'USER',
      isModalOpen: props.isModal ?? false,
      preferences: [],
      previousPrefs: [],
      initialLoading: true,
      showAgreement: false,
    };
  }

  componentDidMount() {
    // auto update user preferences for level "USER"
    if (this.props.preferences) {
      autoUpdateGainsightUserPreferences(this.props.preferences).then((prefs: any) => {
        prefs && this.props.updatePreferences(prefs);
      });
    }
  }

  static getDerivedStateFromProps(props: any, state: any) {
    const filteredPrefs: Preference[] = props.preferences?.filter((p: any) => p.key !== 'GS_TAG');
    if (Array.isArray(props.preferences) && !_isEqual(props.preferences, state.preferences)) {
      let showAgreement = false;

      const tenantConsentForQuality = filteredPrefs.find(
        (pref) => pref.key === 'GS_DATA_COLLECTION_FOR_QUALITY_CONSENT' && pref.level === 'TENANT'
      );
      const userConsentForQuality = filteredPrefs.find(
        (pref) => pref.key === 'GS_DATA_COLLECTION_FOR_QUALITY_CONSENT' && pref.level === 'USER'
      );
      let qualityConsent = tenantConsentForQuality && { ...tenantConsentForQuality };

      if (!qualityConsent) {
        const opsConsentForQuality = filteredPrefs.find(
          (pref) => pref.key === 'GS_DATA_COLLECTION_FOR_QUALITY_CONSENT' && pref.level === 'OPS'
        );
        qualityConsent = opsConsentForQuality && { ...opsConsentForQuality };
        if (state.userType === 'TENANT') {
          if (qualityConsent?.value === 'ask' || !props.isModal) {
            showAgreement = true;
          }
        } else if (state.userType === 'USER') {
          if (!props.isModal) {
            // this will show agreement card on user preference page
            showAgreement = true;
          }
        }
      } else if (!props.isModal) {
        // this will show agreement card on user preference page
        showAgreement = true;
      }

      if (qualityConsent?.value === 'true' && !userConsentForQuality) {
        // show user alert when 'USER' level preferences are auto-updated
        showUserAlert();
      }

      return {
        initialLoading: false,
        preferences: filteredPrefs,
        previousPrefs: filteredPrefs,
        showAgreement: showAgreement,
      };
    }
    return null;
  }

  handleEventListeners() {
    this.adaptAgreementRef.addEventListener &&
      this.adaptAgreementRef.addEventListener('onStateChange', this.handleStateChange);
  }

  handleStateChange = (e: any) => {
    this.updateUserPreferences(e.detail);
  };

  updateUserPreferences(updatedPrefs: any) {
    // set track usage in preferences
    const newPreferences = this.setTrackUsage(updatedPrefs);

    if (_isEqual(this.state.previousPrefs, newPreferences)) {
      return;
    }
    this.setState({
      previousPrefs: [...newPreferences],
    });
    setImsUserPreferences(newPreferences)
      .then((res) => {
        this.updatePreferenceInProps(newPreferences);
        let preferenceUpdated = true;
        res?.forEach((pref: any) => {
          if (pref.status !== 'OK') {
            preferenceUpdated = false;
          }
        });
        if (preferenceUpdated) {
          appEvents.emit(AppEvents.alertSuccess, [
            'Analytics preferences have been updated',
            'Your analytics choices have been submitted. If you would like to change these settings you may do so in your Preferences.',
          ]);
        } else {
          appEvents.emit(AppEvents.alertWarning, ['Some preferences were not updated.', 'Please Try Again']);
        }
      })
      .catch((e) => {
        console.log(e);
      });
  }

  setTrackUsage(newPreferences: Preference[]) {
    let tenantConsentForQuality = newPreferences.find(
      (pref) => pref.key === 'GS_DATA_COLLECTION_FOR_QUALITY_CONSENT' && pref.level === 'TENANT'
    );
    if (!tenantConsentForQuality) {
      tenantConsentForQuality = this.state.previousPrefs?.find(
        (pref) => pref.key === 'GS_DATA_COLLECTION_FOR_QUALITY_CONSENT' && pref.level === 'OPS'
      );
    }
    const userConsentForQuality = newPreferences.find(
      (pref) => pref.key === 'GS_DATA_COLLECTION_FOR_QUALITY_CONSENT' && pref.level === 'USER'
    );
    if (tenantConsentForQuality?.value === 'true' && userConsentForQuality?.value === 'true') {
      newPreferences.push({
        key: 'GS_TRACK_USAGE',
        value: userConsentForQuality.value,
        level: 'USER',
      });
    } else {
      newPreferences.push({
        key: 'GS_TRACK_USAGE',
        value: 'false',
        level: 'USER',
      });
    }
    return newPreferences;
  }

  updatePreferenceInProps(preferences: Preference[]) {
    let previousPreferences: Preference[] = cloneDeep(this.state.preferences);
    let newPreferences: Preference[] = [];
    if (this.state.userType === 'USER' && previousPreferences.length === 2) {
      newPreferences.push(...previousPreferences);
      newPreferences.push(...preferences);
    } else if (this.state.userType === 'TENANT' && !previousPreferences.length) {
      newPreferences.push(...preferences);
    } else {
      newPreferences = previousPreferences.map((pref: Preference) => {
        let consent: any = preferences.find((p: Preference) => p.key === pref.key && p.level === pref.level);
        pref.value = consent?.value || pref.value;
        return pref;
      });
    }
    this.props?.updatePreferences(newPreferences);
  }

  render() {
    return (
      <div className="css-xs0vux">
        {this.state.showAgreement && !this.state.initialLoading && (
          <adapt-agreement
            ref={(elem: any) => {
              this.adaptAgreementRef = elem;
              elem && this.handleEventListeners();
              return elem;
            }}
            is-modal={this.props.isModal}
            user-type={this.state.userType}
            preferences={JSON.stringify(this.state.preferences)}
          ></adapt-agreement>
        )}
      </div>
    );
  }

  componentWillUnmount() {
    this.adaptAgreementRef.addEventListener &&
      this.adaptAgreementRef.addEventListener('onStateChange', this.handleStateChange);
  }
}

const GainsightAlertComponent: React.FC<any> = () => {
  return (
    <span>
      Note: Your IT administrator has enabled the collection of anonymous usage data for your organization. You can
      manage your individual collection preferences
      <Link aria-label="Gainsight user consent" href="/profile">
        {' here'}
      </Link>
    </span>
  );
};

const showUserAlert = () => {
  store.dispatch(notifyApp(createInfoNotification('', '', '', <GainsightAlertComponent />)));
};

// customElements.get('adapt-agreement')
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace JSX {
    interface IntrinsicElements {
      'adapt-agreement': any;
    }
  }
}

export default connector(GainsightAgreement);
