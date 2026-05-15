import { getWrapper, renderHook } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantPermissionsHelper } from '../../test/test-utils';
import * as misc from '../../utils/misc';

import { isNotSupported } from './abilityUtils';
import {
  useEnrichmentAbilities,
  useEnrichmentAbility,
  useFolderBulkActionAbilities,
  useFolderBulkActionAbility,
} from './otherAbilities';
import { EnrichmentAction, FolderBulkAction, isInsufficientPermissions } from './types';

setupMswServer();

const wrapper = () => getWrapper({ renderWithRouter: true });

describe('otherAbilities — folder bulk action', () => {
  it('grants Pause and Delete to org admins', () => {
    jest.spyOn(misc, 'isAdmin').mockReturnValue(true);

    const { result } = renderHook(() => useFolderBulkActionAbilities(), { wrapper: wrapper() });

    expect(result.current[FolderBulkAction.Pause].granted).toBe(true);
    expect(result.current[FolderBulkAction.Delete].granted).toBe(true);
  });

  it('denies Pause and Delete to non-admins', () => {
    jest.spyOn(misc, 'isAdmin').mockReturnValue(false);

    const { result } = renderHook(() => useFolderBulkActionAbilities(), { wrapper: wrapper() });

    expect(result.current[FolderBulkAction.Pause].granted).toBe(false);
    expect(isInsufficientPermissions(result.current[FolderBulkAction.Pause])).toBe(true);
    expect(result.current[FolderBulkAction.Delete].granted).toBe(false);
    expect(isInsufficientPermissions(result.current[FolderBulkAction.Delete])).toBe(true);
  });

  it('returns the correct single-action slice via useFolderBulkActionAbility', () => {
    jest.spyOn(misc, 'isAdmin').mockReturnValue(true);

    const { result } = renderHook(() => useFolderBulkActionAbility(FolderBulkAction.Pause), { wrapper: wrapper() });

    expect(result.current.granted).toBe(true);
  });
});

describe('otherAbilities — enrichment', () => {
  const originalFeatureToggle = config.featureToggles.alertEnrichment;

  beforeEach(() => {
    config.featureToggles.alertEnrichment = true;
  });

  afterEach(() => {
    config.featureToggles.alertEnrichment = originalFeatureToggle;
  });

  it('grants read and write to admin users when feature is enabled', () => {
    grantPermissionsHelper([]);
    jest.spyOn(misc, 'isAdmin').mockReturnValue(true);

    const { result } = renderHook(() => useEnrichmentAbilities(), { wrapper: wrapper() });

    expect(result.current[EnrichmentAction.Read].granted).toBe(true);
    expect(result.current[EnrichmentAction.Write].granted).toBe(true);
  });

  it('grants only read when user has enrichments:read permission', () => {
    jest.spyOn(misc, 'isAdmin').mockReturnValue(false);
    grantPermissionsHelper([AccessControlAction.AlertingEnrichmentsRead]);

    const { result } = renderHook(() => useEnrichmentAbilities(), { wrapper: wrapper() });

    expect(result.current[EnrichmentAction.Read].granted).toBe(true);
    expect(result.current[EnrichmentAction.Write].granted).toBe(false);
    expect(isInsufficientPermissions(result.current[EnrichmentAction.Write])).toBe(true);
  });

  it('grants only write when user has enrichments:write permission', () => {
    jest.spyOn(misc, 'isAdmin').mockReturnValue(false);
    grantPermissionsHelper([AccessControlAction.AlertingEnrichmentsWrite]);

    const { result } = renderHook(() => useEnrichmentAbilities(), { wrapper: wrapper() });

    expect(result.current[EnrichmentAction.Read].granted).toBe(false);
    expect(isInsufficientPermissions(result.current[EnrichmentAction.Read])).toBe(true);
    expect(result.current[EnrichmentAction.Write].granted).toBe(true);
  });

  it('grants both read and write when user has both permissions', () => {
    jest.spyOn(misc, 'isAdmin').mockReturnValue(false);
    grantPermissionsHelper([AccessControlAction.AlertingEnrichmentsRead, AccessControlAction.AlertingEnrichmentsWrite]);

    const { result } = renderHook(() => useEnrichmentAbilities(), { wrapper: wrapper() });

    expect(result.current[EnrichmentAction.Read].granted).toBe(true);
    expect(result.current[EnrichmentAction.Write].granted).toBe(true);
  });

  it('denies all when user is not admin and has no permissions', () => {
    jest.spyOn(misc, 'isAdmin').mockReturnValue(false);
    grantPermissionsHelper([]);

    const { result } = renderHook(() => useEnrichmentAbilities(), { wrapper: wrapper() });

    expect(result.current[EnrichmentAction.Read].granted).toBe(false);
    expect(isInsufficientPermissions(result.current[EnrichmentAction.Read])).toBe(true);
    expect(result.current[EnrichmentAction.Write].granted).toBe(false);
    expect(isInsufficientPermissions(result.current[EnrichmentAction.Write])).toBe(true);
  });

  it('returns correct ability for a single action via useEnrichmentAbility', () => {
    jest.spyOn(misc, 'isAdmin').mockReturnValue(false);
    grantPermissionsHelper([AccessControlAction.AlertingEnrichmentsRead]);

    const { result } = renderHook(() => useEnrichmentAbility(EnrichmentAction.Read), { wrapper: wrapper() });

    expect(result.current.granted).toBe(true);
  });

  it('reports NOT_SUPPORTED when feature toggle is disabled', () => {
    config.featureToggles.alertEnrichment = false;
    jest.spyOn(misc, 'isAdmin').mockReturnValue(true);
    grantPermissionsHelper([AccessControlAction.AlertingEnrichmentsRead, AccessControlAction.AlertingEnrichmentsWrite]);

    const { result } = renderHook(() => useEnrichmentAbilities(), { wrapper: wrapper() });

    expect(isNotSupported(result.current[EnrichmentAction.Read])).toBe(true);
    expect(isNotSupported(result.current[EnrichmentAction.Write])).toBe(true);
  });
});
