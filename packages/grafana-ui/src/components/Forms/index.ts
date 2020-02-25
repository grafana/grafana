import { Controller as InputControl } from 'react-hook-form';
import { getFormStyles } from './getFormStyles';
import { Label } from './Label';
import { Input } from './Input/Input';
import { ButtonSelect } from './Select/ButtonSelect';
import { RadioButtonGroup } from './RadioButtonGroup/RadioButtonGroup';
import { AsyncSelect, Select } from './Select/Select';
import { Form } from './Form';
import { Field } from './Field';
import { Button, LinkButton } from './Button';
import { Switch } from './Switch';
import { TextArea } from './TextArea/TextArea';

const Forms = {
  RadioButtonGroup,
  Switch,
  getFormStyles,
  Label,
  Input,
  Form,
  Field,
  Button,
  LinkButton,
  Select,
  ButtonSelect,
  InputControl,
  AsyncSelect,
  TextArea,
};

export default Forms;
