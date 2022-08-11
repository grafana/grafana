import { DeepPartial, SubmitHandler, UnpackNestedValue, useForm } from 'react-hook-form';

interface UseCorrelationFormOptions<T> {
  onSubmit: SubmitHandler<T>;
  defaultValues?: UnpackNestedValue<DeepPartial<T>>;
}
export const useCorrelationForm = <T>({ onSubmit, defaultValues }: UseCorrelationFormOptions<T>) => {
  const {
    handleSubmit: submit,
    control,
    register,
    formState: { errors },
  } = useForm<T>({ defaultValues });

  const handleSubmit = submit(onSubmit);

  return { control, handleSubmit, register, errors };
};
