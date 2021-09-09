import { NavModelItem } from '@grafana/data';
import { updateConfig } from '../../config';
import { getForcedLoginUrl, linkIsActive } from './utils';

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

describe('linkIsActive', () => {
  it('returns true if the link url matches the pathname', () => {
    const mockPathName = '/test';
    const mockLink: NavModelItem = {
      text: 'Test',
      url: '/test',
    };
    expect(linkIsActive(mockPathName, mockLink)).toBe(true);
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
    expect(linkIsActive(mockPathName, mockLink)).toBe(true);
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
    expect(linkIsActive(mockPathName, mockLink)).toBe(false);
  });
});
