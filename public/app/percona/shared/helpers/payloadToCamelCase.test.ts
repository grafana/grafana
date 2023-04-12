import { payloadToCamelCase } from './payloadToCamelCase';

describe('payloadToCamelCase', () => {
  it('should convert from snake_case', () => {
    const obj = {
      name: 'John',
      zip_code: '1234-567',
      full_address_str: 'fake_address_name',
    };

    expect(payloadToCamelCase(obj)).toEqual({
      name: 'John',
      zipCode: '1234-567',
      fullAddressStr: 'fake_address_name',
    });
  });

  it('should convert from kebab-case', () => {
    const obj = {
      name: 'John',
      'zip-code': '1234-567',
      'full-address-str': 'fake_address_name',
    };

    expect(payloadToCamelCase(obj)).toEqual({
      name: 'John',
      zipCode: '1234-567',
      fullAddressStr: 'fake_address_name',
    });
  });

  it('should convert recursively', () => {
    const obj = {
      name: 'John',
      address: {
        address_state: 'California',
        'zip-code': '1234-567',
      },
    };

    expect(payloadToCamelCase(obj)).toEqual({
      name: 'John',
      address: {
        addressState: 'California',
        zipCode: '1234-567',
      },
    });
  });

  it('should correctly convert arrays', () => {
    const obj = {
      name: 'John',
      addresses: [
        {
          address_state: 'California',
          'zip-code': '1234-567',
        },
        {
          address_state: 'New York',
          'zip-code': '9999-999',
        },
      ],
    };

    expect(payloadToCamelCase(obj)).toEqual({
      name: 'John',
      addresses: [
        {
          addressState: 'California',
          zipCode: '1234-567',
        },
        {
          addressState: 'New York',
          zipCode: '9999-999',
        },
      ],
    });
  });

  it('should ignore specified keys', () => {
    const obj = {
      name: 'John',
      addresses: [
        {
          address_state: 'California',
          'zip-code': '1234-567',
        },
        {
          address_state: 'New York',
          'zip-code': '9999-999',
        },
      ],
      marital_status: 'single',
    };

    expect(payloadToCamelCase(obj, ['address_state', 'marital_status'])).toEqual({
      name: 'John',
      addresses: [
        {
          address_state: 'California',
          zipCode: '1234-567',
        },
        {
          address_state: 'New York',
          zipCode: '9999-999',
        },
      ],
      marital_status: 'single',
    });
  });
});
