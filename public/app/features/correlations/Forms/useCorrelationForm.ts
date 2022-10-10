import { DeepPartial, FieldValues, SubmitHandler, UnpackNestedValue, useForm } from 'react-hook-form';

interface UseCorrelationFormOptions<T extends FieldValues> {
  onSubmit: SubmitHandler<T>;
  defaultValues?: UnpackNestedValue<DeepPartial<T>>;
}
export const useCorrelationForm = <T extends FieldValues>({
  onSubmit,
  defaultValues,
}: UseCorrelationFormOptions<T>) => {
  const {
    handleSubmit: submit,
    control,
    register,
    formState: { errors },
  } = useForm<T>({ defaultValues });

  const handleSubmit = submit(onSubmit);

  return { control, handleSubmit, register, errors };
};
