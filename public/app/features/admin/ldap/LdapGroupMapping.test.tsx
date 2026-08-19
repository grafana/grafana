import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { render, screen } from 'test/test-utils';

import { contextSrv } from 'app/core/services/context_srv';
import { type LdapPayload } from 'app/types/ldap';

import { GroupMappingComponent } from './LdapGroupMapping';

const GROUP_MAPPINGS_PATH = 'settings.config.servers.0.group_mappings' as const;

const groupMappings = [
  { group_dn: 'CN=Group1', org_role: 'Admin', org_id: 1, grafana_admin: true },
  { group_dn: 'CN=Group2', org_role: 'Admin', org_id: 1, grafana_admin: false },
  { group_dn: 'CN=Group3', org_role: 'Editor', org_id: 1, grafana_admin: false },
];

// Mirrors how LdapDrawer renders and removes rows, index-based React key
// included, so the list behaves the same here as it does in the drawer.
const GroupMappings = () => {
  const { getValues, setValue, watch } = useFormContext<LdapPayload>();

  const onRemove = (index: number) => {
    const mappings = getValues(GROUP_MAPPINGS_PATH);
    setValue(GROUP_MAPPINGS_PATH, [...mappings.slice(0, index), ...mappings.slice(index + 1)]);
  };

  return (
    <>
      {watch(GROUP_MAPPINGS_PATH)?.map((_, i) => (
        <GroupMappingComponent key={i} groupMappingIndex={i} onRemove={() => onRemove(i)} />
      ))}
    </>
  );
};

const Wrapper = () => {
  const methods = useForm<LdapPayload>({
    defaultValues: {
      settings: { config: { servers: [{ group_mappings: groupMappings }] } },
    },
  });
  return (
    <FormProvider {...methods}>
      <GroupMappings />
    </FormProvider>
  );
};

const setup = () => render(<Wrapper />);

// Anchored, because Field renders the description inside the <label> too
const inputsFor = (label: string) => screen.getAllByLabelText<HTMLInputElement>(new RegExp(`^${label}`));

describe('GroupMappingComponent', () => {
  beforeEach(() => {
    contextSrv.isGrafanaAdmin = true;
  });

  // Duplicate ids make every row's label point at the first row's input, so
  // clicking one row's Grafana Admin toggle flips a different row's mapping.
  it('gives each group mapping row its own form control ids', () => {
    setup();

    for (const label of ['Group DN', 'Org ID', 'Grafana Admin']) {
      const controls = inputsFor(label);
      expect(controls).toHaveLength(groupMappings.length);
      expect(new Set(controls.map(({ id }) => id)).size).toBe(groupMappings.length);
    }
  });

  it('shows the remaining mappings after one is removed', async () => {
    const { user } = setup();

    await user.click(screen.getAllByRole('button', { name: 'Remove group mapping' })[1]);

    expect(inputsFor('Group DN').map(({ value }) => value)).toEqual(['CN=Group1', 'CN=Group3']);
    expect(inputsFor('Grafana Admin').map(({ checked }) => checked)).toEqual([true, false]);
  });
});
