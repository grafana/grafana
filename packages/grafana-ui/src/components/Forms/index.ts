import { Controller as InputControl } from 'react-hook-form';
import { getFormStyles } from './getFormStyles';
import { Label } from './Label';
import { Input } from './Input/Input';
import { RadioButtonGroup } from './RadioButtonGroup/RadioButtonGroup';
import { Form } from './Form';
import { Field } from './Field';
import { Switch } from './Switch';
import { Legend } from './Legend';
import { TextArea } from './TextArea/TextArea';
import { Checkbox } from './Checkbox';
//Remove after Enterprise migrations have been merged
import { Select } from '../Select/Select';

const Forms = {
  RadioButtonGroup,
  Switch,
  getFormStyles,
  Label,
  Input,
  Form,
  Field,
  InputControl,
  TextArea,
  Checkbox,
  Legend,
  Select,
};

export default Forms;
