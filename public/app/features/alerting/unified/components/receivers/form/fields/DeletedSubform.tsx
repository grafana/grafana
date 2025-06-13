import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';

interface Props {
  pathPrefix: string;
}

// we can't drop the deleted item from list entirely because
// there will be a rece condition with register/unregister calls in react-hook-form
// and fields will become randomly erroneously unregistered
export function DeletedSubForm({ pathPrefix }: Props): JSX.Element {
  const { register } = useFormContext();

  // required to be registered or react-hook-form will randomly drop the values when it feels like it
  useEffect(() => {
    register(`${pathPrefix}.__id`);
    register(`${pathPrefix}.__deleted`);
  }, [register, pathPrefix]);

  return <>{null}</>;
}
