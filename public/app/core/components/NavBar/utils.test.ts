import { NavModelItem } from '@grafana/data';
import { updateConfig } from '../../config';
import { getForcedLoginUrl, isLinkActive, isSearchActive } from './utils';

describe('getForcedLoginUrl', () => {
  it.each`
    appSubUrl          | url                    | expected
    ${''}              | ${'/whatever?a=1&b=2'} | ${'/whatever?a=1&b=2&forceLogin=true'}
    ${'/grafana'}      | ${'/whatever?a=1&b=2'} | ${'/grafana/whatever?a=1&b=2&forceLogin=true'}
    ${'/grafana/test'} | ${'/whatever?a=1&b=2'} | ${'/grafana/test/whatever?a=1&b=2&forceLogin=true'}
    ${'/grafana'}      | ${''}                  | ${'/grafana?forceLogin=true'}
    ${'/grafana'}      | ${'/whatever'}         | ${'/grafana/whatever?forceLogin=true'}
    ${'/grafana'}      | ${'/whatever/'}        | ${'/grafana/whatever/?forceLogin=true'}
  `(
    "when appUrl set to '$appUrl' and appSubUrl set to '$appSubUrl' then result should be '$expected'",
    ({ appSubUrl, url, expected }) => {
      updateConfig({
        appSubUrl,
      });

      const result = getForcedLoginUrl(url);

      expect(result).toBe(expected);
    }
  );
});

describe('isLinkActive', () => {
  it('returns true if the link url matches the pathname', () => {
    const mockPathName = '/test';
    const mockLink: NavModelItem = {
      text: 'Test',
      url: '/test',
    };
    expect(isLinkActive(mockPathName, mockLink)).toBe(true);
  });

  it('returns true if the pathname starts with the link url', () => {
    const mockPathName = '/test/edit';
    const mockLink: NavModelItem = {
      text: 'Test',
      url: '/test',
    };
    expect(isLinkActive(mockPathName, mockLink)).toBe(true);
  });

  it('returns true if a child link url matches the pathname', () => {
    const mockPathName = '/testChild2';
    const mockLink: NavModelItem = {
      text: 'Test',
      url: '/test',
      children: [
        {
          text: 'TestChild',
          url: '/testChild',
        },
        {
          text: 'TestChild2',
          url: '/testChild2',
        },
      ],
    };
    expect(isLinkActive(mockPathName, mockLink)).toBe(true);
  });

  it('returns true if the pathname starts with a child link url', () => {
    const mockPathName = '/testChild2/edit';
    const mockLink: NavModelItem = {
      text: 'Test',
      url: '/test',
      children: [
        {
          text: 'TestChild',
          url: '/testChild',
        },
        {
          text: 'TestChild2',
          url: '/testChild2',
        },
      ],
    };
    expect(isLinkActive(mockPathName, mockLink)).toBe(true);
  });

  it('returns false if none of the link urls match the pathname', () => {
    const mockPathName = '/somethingWeird';
    const mockLink: NavModelItem = {
      text: 'Test',
      url: '/test',
      children: [
        {
          text: 'TestChild',
          url: '/testChild',
        },
        {
          text: 'TestChild2',
          url: '/testChild2',
        },
      ],
    };
    expect(isLinkActive(mockPathName, mockLink)).toBe(false);
  });

  it('returns false for the base route if the pathname is not an exact match', () => {
    const mockPathName = '/foo';
    const mockLink: NavModelItem = {
      text: 'Test',
      url: '/',
      children: [
        {
          text: 'TestChild',
          url: '/',
        },
        {
          text: 'TestChild2',
          url: '/testChild2',
        },
      ],
    };
    expect(isLinkActive(mockPathName, mockLink)).toBe(false);
  });
});

describe('isSearchActive', () => {
  it('returns true if the search query parameter is "open"', () => {
    const mockLocation = {
      hash: '',
      pathname: '/',
      search: '?search=open',
      state: '',
    };
    expect(isSearchActive(mockLocation)).toBe(true);
  });

  it('returns false if the search query parameter is missing', () => {
    const mockLocation = {
      hash: '',
      pathname: '/',
      search: '',
      state: '',
    };
    expect(isSearchActive(mockLocation)).toBe(false);
  });
});
