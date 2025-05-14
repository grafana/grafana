import { v0alpha1ContactPointAdapter } from '../../adapters';
import { ContactPoint as ContactPoint_v0alpha1 } from '../../api/v0alpha1/types';

import { ContactPointSelector, ContactPointSelectorProps } from './ContactPointSelector';
type VersionedContactPointSelectorProps = {
  useApiVersion: 'v0alpha1' | 'v0alpha2';
  onChange: ContactPointSelectorProps<ContactPoint_v0alpha1>['onChange'];
};

export function VersionedContactPointSelector({ useApiVersion, onChange }: VersionedContactPointSelectorProps) {
  if (useApiVersion === 'v0alpha1') {
    return <ContactPointSelector adapter={v0alpha1ContactPointAdapter} onChange={onChange} />;
  }
  return null;
}
