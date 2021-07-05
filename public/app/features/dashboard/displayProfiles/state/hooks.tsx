import { getConfig } from 'app/core/config';
import React, { useCallback } from 'react';
import { locationService } from '@grafana/runtime';
import { standardProfile } from '../profiles/standard';
import { DashboardDisplayProfile } from '../types';
import { DisplayProfileId, getDisplayProfile } from '../profiles';
import { toggleKioskMode } from 'app/core/navigation/kiosk';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { UrlQueryMap } from '@grafana/data';

export function useDisplayProfile(): DashboardDisplayProfile {
  const [params] = useQueryParams();
  const profileId = getCurrentDisplayProfileId(params);
  const enabled = isEnabled();
  const profile = getDisplayProfile(profileId);

  if (!profile || !enabled) {
    return standardProfile;
  }

  return profile;
}

export function useDisplayProfileId(): DisplayProfileId {
  const [params] = useQueryParams();

  if (getConfig().featureToggles.customKiosk) {
    switch (params['profile']) {
      case DisplayProfileId.custom:
        return DisplayProfileId.custom;
      case DisplayProfileId.kiosk:
        return DisplayProfileId.kiosk;
      case DisplayProfileId.tv:
        return DisplayProfileId.tv;
      default:
        return DisplayProfileId.standard;
    }
  }

  switch (params['kiosk']) {
    case 'custom':
      return DisplayProfileId.custom;
    case '1':
    case true:
      return DisplayProfileId.kiosk;
    case 'tv':
    default:
      return DisplayProfileId.tv;
  }
}

export function useOnToggleDisplayProfile(): () => void {
  return useCallback(() => {
    if (!getConfig().featureToggles.customKiosk) {
      return toggleKioskMode();
    }

    if (isEnabled()) {
      return locationService.partial({ kiosk: null });
    }
    return locationService.partial({ kiosk: true });
  }, []);
}

type OnChangeDisplayProfile = (profileId: DisplayProfileId) => void;

export function useOnChangeDisplayProfile(): OnChangeDisplayProfile {
  return changeDisplayProfileId;
}

/** HOC for the non-functional components */
type ToggleDisplayProfileProps = {
  children: (onToggle: () => void) => React.ReactElement;
};

export function ToggleDisplayProfile({ children }: ToggleDisplayProfileProps): React.ReactElement {
  const toggler = useOnToggleDisplayProfile();
  return children(toggler);
}

type ChangeDashboardProfileProps = {
  children: (onChangeConfig: OnChangeDisplayProfile) => React.ReactElement;
};

export function ChangeDisplayProfile({ children }: ChangeDashboardProfileProps): React.ReactElement {
  return children(changeDisplayProfileId);
}

function changeDisplayProfileId(id: DisplayProfileId): void {
  if (!getConfig().featureToggles.customKiosk) {
    return;
  }

  switch (id) {
    case DisplayProfileId.tv:
      return locationService.partial({
        kiosk: isEnabled() ? 'tv' : null,
        profile: DisplayProfileId.tv,
      });

    case DisplayProfileId.kiosk:
      return locationService.partial({
        kiosk: isEnabled() ? true : null,
        profile: DisplayProfileId.kiosk,
      });

    case DisplayProfileId.custom:
      return locationService.partial({
        kiosk: isEnabled() ? true : null,
        profile: DisplayProfileId.custom,
      });

    default:
      return locationService.partial({
        kiosk: null,
        profile: null,
      });
  }
}

export function getCurrentDisplayProfileId(queryParams: UrlQueryMap): DisplayProfileId {
  const kiosk = queryParams['kiosk'];
  const profile = queryParams['profile'];
  const isCustomEnabled = getConfig().featureToggles.customKiosk;

  if (isCustomEnabled && profile) {
    switch (profile) {
      case DisplayProfileId.kiosk:
        return DisplayProfileId.kiosk;
      case DisplayProfileId.tv:
        return DisplayProfileId.tv;
      case DisplayProfileId.custom:
        return DisplayProfileId.custom;
      default:
        return DisplayProfileId.standard;
    }
  }

  switch (kiosk) {
    case 'tv':
      return DisplayProfileId.tv;
    case '1':
    case true:
      return DisplayProfileId.kiosk;
    default:
      return DisplayProfileId.standard;
  }
}

function isEnabled(): boolean {
  const kiosk = locationService.getSearchObject().kiosk;

  switch (kiosk) {
    case 'tv':
    case '1':
    case true:
      return true;
    default:
      return false;
  }
}
