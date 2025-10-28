# POC Testing Checklist - Integration Versioning

## Pre-requisitos

✅ Tener Grafana corriendo en modo desarrollo:

```bash
yarn start
```

✅ Los mocks de MSW deben estar activos (por defecto en dev)

---

## Test 1: Ver Contact Points Legacy en la Lista

### Objetivo

Verificar que los contact points legacy aparecen en la lista normalmente.

### Pasos

1. Navegar a **Alerting > Contact points**
2. Buscar en la lista:
   - "Legacy Slack from Mimir"
   - "Legacy Webhook"

### Resultado Esperado

✅ Ambos contact points aparecen en la lista
✅ Se ven como cualquier otro contact point (sin indicación especial en la lista)

---

## Test 2: Editar Contact Point Legacy - Ver Badge

### Objetivo

Verificar que el badge "Legacy (Mimir)" aparece al editar un contact point con integración v0.

### Pasos

1. En la lista de Contact points, hacer clic en **"Legacy Slack from Mimir"**
2. Hacer clic en **Edit**
3. Observar el campo "Integration"

### Resultado Esperado

✅ Dropdown muestra "Slack" seleccionado y **HABILITADO** (puede cambiarse)
✅ Debajo del dropdown aparecen **2 badges naranjas**:

- Badge 1: **"Legacy (Mimir)"** con icono de warning (⚠️)
- Badge 2: **"V0MIMIR1"** mostrando la versión
  ✅ Al hacer hover en badge 1, muestra tooltip: _"Settings are read-only but you can change to a different integration type to convert"_
  ✅ **Alerta azul (info)** en la parte superior con título "Legacy Integration - Read Only"
  ✅ Texto de la alerta explica que es importada de Mimir y está en modo read-only

### Screenshot Sugerido

Captura el form con el badge Y la alerta visible para la presentación al equipo.

---

## Test 3: Verificar Read-Only State de Legacy Integration

### Objetivo

Confirmar que TODOS los campos están deshabilitados (read-only) para integraciones legacy.

### Pasos

1. Continuar editando "Legacy Slack from Mimir"
2. Intentar editar los campos:
   - Dropdown "Integration" → Debería estar disabled
   - Recipient field → Debería estar disabled
   - Username (optional) → Debería estar disabled
   - Token (secure field) → Debería estar disabled
3. Intentar hacer clic en "Save" button

### Resultado Esperado

✅ **TODOS los campos están deshabilitados** (gris, no interactivos)
✅ No se puede cambiar el dropdown de integración
✅ No se puede editar ningún campo de settings
✅ Notification settings también read-only
✅ Botón "Save" debería estar deshabilitado (no se puede guardar cambios)
✅ No hay errores en consola

### Justificación

**Stage 2:** Las integraciones legacy importadas de Mimir son READ-ONLY.
**Stage 3 (futuro):** Usuario podrá hacer "Convert" para hacerlas editables.

---

## Test 4: Crear Nuevo Contact Point - Sin Legacy en Dropdown

### Objetivo

Verificar que las integraciones legacy NO aparecen al crear un nuevo contact point.

### Pasos

1. Ir a **Alerting > Contact points**
2. Hacer clic en **"New contact point"**
3. Abrir el dropdown "Integration"
4. Buscar "Slack" en la lista

### Resultado Esperado

✅ Solo aparece **"Slack"** una vez (no duplicado)
✅ NO aparece "Slack (Legacy)" ni "Slack v0"
✅ El dropdown está limpio sin opciones legacy

### Comparación

- **Antes del POC:** Podrían aparecer duplicados si backend devuelve v0 y v1
- **Con el POC:** Solo aparece la última versión (v1)

---

## Test 5: Console - Verificar Notifiers Enriquecidos

### Objetivo

Confirmar que los notifiers están enriquecidos con información de versiones.

### Pasos

1. Abrir DevTools > Console
2. En el form de crear/editar contact point, ejecutar:

```javascript
// En la consola del browser
// Nota: Esto requiere acceso al React context, así que usa React DevTools
```

**Alternativa más fácil:**

1. Ir a **Network tab** en DevTools
2. Buscar la request a `/api/alert-notifiers`
3. Ver la response
4. Ir a **Sources** y poner un breakpoint en `GrafanaReceiverForm.tsx` línea donde se llama `enrichNotifiersWithVersionsPOC`

### Resultado Esperado (en el código)

Los notifiers enriquecidos deben tener:

```javascript
// Versión Grafana (v1)
{
  type: "slack",
  name: "Slack",
  version: "v1",
  deprecated: false,
  canCreate: true,
  options: [...]
}

// Versión Legacy (v0)
{
  type: "slack_v0",
  name: "Slack",
  version: "v0",
  deprecated: true,
  canCreate: false,
  options: [...]
}
```

---

## Test 6: Editar Contact Point Normal (v1) - Sin Badge

### Objetivo

Verificar que contact points normales (no legacy) NO muestran badge.

### Pasos

1. Ir a **Alerting > Contact points**
2. Editar un contact point normal como **"Slack with multiple channels"**
3. Observar el campo "Integration"

### Resultado Esperado

✅ Dropdown muestra "Slack" seleccionado
✅ **NO hay badge** al lado del dropdown
✅ Form funciona normalmente

---

## Test 7: Cambiar Integración en Contact Point Legacy

### Objetivo

Verificar que al cambiar la integración en un contact point legacy, el nuevo valor NO muestra badge.

### Pasos

1. Editar **"Legacy Slack from Mimir"**
2. Cambiar la integración de "Slack" a "Email"
3. Observar si aparece badge

### Resultado Esperado

✅ Badge desaparece (porque Email seleccionado es v1, no v0)
✅ Dropdown funciona normalmente
✅ Si vuelves a seleccionar "Slack", NO muestra badge (porque seleccionas v1)

**Nota:** No puedes volver a seleccionar `slack_v0` porque no está en el dropdown al editar.

---

## Test 8: Intentar Guardar Contact Point Legacy Editado

### Objetivo

Verificar que se puede guardar un contact point con integración legacy editada.

### Pasos

1. Editar **"Legacy Webhook"**
2. Cambiar la URL del webhook
3. Hacer clic en **Save**

### Resultado Esperado

✅ Se guarda correctamente
✅ No hay errores

**Nota:** En el POC, el MSW handler puede no persistir cambios, pero no debería dar error.

---

## Test 9: Filtrado de Notifiers por Context

### Objetivo

Verificar que la lógica de filtrado funciona según el contexto (crear vs editar).

### Setup Temporal

Agregar `console.log` en `ChannelSubForm.tsx`:

```typescript
// Después de línea 171
console.log('🔍 All notifiers:', notifiers.length);
console.log('🔍 Latest versions for dropdown:', latestVersions.length);
console.log('🔍 Notifiers to show:', notifiersToShow.length);
```

### Pasos

1. Abrir Console de DevTools
2. Ir a crear nuevo contact point
3. Ver logs en consola
4. Ahora editar "Legacy Slack from Mimir"
5. Ver logs nuevamente

### Resultado Esperado (Crear)

```
🔍 All notifiers: ~50+ (incluye v0 y v1)
🔍 Latest versions for dropdown: ~25 (solo v1 creables)
🔍 Notifiers to show: ~25
```

### Resultado Esperado (Editar)

```
🔍 All notifiers: ~50+ (incluye v0 y v1)
🔍 Latest versions for dropdown: ~25
🔍 Notifiers to show: ~25 (dropdown no incluye v0)
```

**Remover logs después del test.**

---

## Test 10: Integración con OnCall (Edge Case)

### Objetivo

Verificar que OnCall integration no se ve afectada por el versionado.

### Pasos

1. Editar **"OnCall Contact point"**
2. Ver el campo Integration

### Resultado Esperado

✅ OnCall aparece normalmente
✅ NO tiene badge (no hay versión legacy de OnCall)
✅ Form funciona correctamente

---

## Checklist Final

Antes de demostrar al equipo, confirmar:

- [ ] Todos los tests pasan
- [ ] Badge se ve correctamente (color, icono, texto)
- [ ] No hay errores en consola
- [ ] Dropdown no tiene duplicados
- [ ] Contact points legacy son editables
- [ ] No se pueden crear nuevos legacy desde UI
- [ ] Screenshots/videos capturados para demo

---

## Issues Conocidos / Limitaciones

### ✅ Esperados (No son bugs)

- Los legacy types (`slack_v0`) no existen en el backend real → Es parte del POC
- Al guardar cambios en MSW, pueden no persistir → MSW mock no implementa persistencia completa
- Si cambias el tipo de una integración legacy, no puedes volver al legacy → Por diseño

### ❌ Bugs Potenciales a Reportar

- Si el badge NO aparece en integraciones legacy → Bug en el código
- Si aparecen duplicados en el dropdown → Bug en filtrado
- Si hay errors en consola → Bug a investigar

---

## Comandos Útiles para Debugging

### Ver Mock Data

```bash
# Ver el archivo de mocks
cat public/app/features/alerting/unified/mocks/server/entities/alertmanager-config/grafana-alertmanager-config.ts | grep -A 20 "Legacy"
```

### Buscar Código del POC

```bash
# Buscar todos los archivos modificados por el POC
grep -r "POC:" public/app/features/alerting/unified/components/receivers/form/
```

### Reset Estado (si algo se rompe)

```bash
# Reiniciar el servidor de desarrollo
# Los mocks se resetean automáticamente
```

---

## Próximos Tests (Cuando Backend Esté Listo)

- [ ] Test con datos reales del backend
- [ ] Test de migración Stage 3 (convert button)
- [ ] Test con múltiples versiones (v0, v1, v2)
- [ ] Test de performance con muchos notifiers
- [ ] Test de compatibilidad con Mimir real importado

---

**¿Todos los tests pasan?** ¡Estás listo para la demo! 🎉
